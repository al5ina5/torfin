import { basename, normalize } from 'node:path'

export function jellyfinItemToMatch(item) {
  if (!item) return null
  const streams = item.MediaSources?.[0]?.MediaStreams || []
  const video = streams.find((stream) => stream.Type === 'Video') || {}
  const height = Number(video.Height) || 0
  return {
    itemId: item.Id || '',
    name: item.Name || 'Library item',
    path: item.Path || '',
    qualityLabel: height >= 2160 ? '4K' : height ? `${height}p` : '',
    width: Number(video.Width) || 0,
    height,
  }
}

async function jellyfinFetch(baseUrl, apiKey, path, options = {}) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const token = String(apiKey || '').trim()
  if (!base || !token) throw new Error('Jellyfin URL and API key are required.')
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'X-Emby-Token': token,
      accept: 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Jellyfin request failed (${response.status})`)
  }
  return response.json()
}

export async function lookupJellyfinLibrary({ baseUrl, apiKey, imdbId, contentType, season, episode }) {
  const provider = `imdb.${String(imdbId || '').trim()}`
  if (!imdbId) return null

  if (contentType === 'series' && season && episode) {
    const seriesBody = await jellyfinFetch(
      baseUrl,
      apiKey,
      `/Items?Recursive=true&IncludeItemTypes=Series&AnyProviderIdEquals=${encodeURIComponent(provider)}&Fields=ProviderIds`,
    )
    const series = Array.isArray(seriesBody?.Items) ? seriesBody.Items[0] : null
    if (!series?.Id) return null
    const episodeBody = await jellyfinFetch(
      baseUrl,
      apiKey,
      `/Shows/${series.Id}/Episodes?Season=${season}&Fields=Path,MediaSources`,
    )
    const items = Array.isArray(episodeBody?.Items) ? episodeBody.Items : []
    const match = items.find((item) => Number(item.IndexNumber) === Number(episode))
    return jellyfinItemToMatch(match)
  }

  const includeType = contentType === 'series' ? 'Series' : 'Movie'
  const body = await jellyfinFetch(
    baseUrl,
    apiKey,
    `/Items?Recursive=true&IncludeItemTypes=${includeType}&AnyProviderIdEquals=${encodeURIComponent(provider)}&Fields=Path,MediaSources`,
  )
  const items = Array.isArray(body?.Items) ? body.Items : []
  return jellyfinItemToMatch(items[0])
}

export async function batchLookupJellyfinLibrary({ baseUrl, apiKey, items }) {
  const matches = {}
  const list = Array.isArray(items) ? items : []
  const concurrency = 6
  let index = 0

  async function worker() {
    while (index < list.length) {
      const current = list[index]
      index += 1
      if (!current?.key || !current.imdbId) continue
      try {
        matches[current.key] = await lookupJellyfinLibrary({
          baseUrl,
          apiKey,
          imdbId: current.imdbId,
          contentType: current.contentType || 'movie',
        })
      } catch {
        matches[current.key] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length || 1) }, () => worker()))
  return matches
}

export async function lookupJellyfinSeasonEpisodes({ baseUrl, apiKey, imdbId, season }) {
  const provider = `imdb.${String(imdbId || '').trim()}`
  if (!imdbId || !season) return []

  const seriesBody = await jellyfinFetch(
    baseUrl,
    apiKey,
    `/Items?Recursive=true&IncludeItemTypes=Series&AnyProviderIdEquals=${encodeURIComponent(provider)}&Fields=ProviderIds`,
  )
  const series = Array.isArray(seriesBody?.Items) ? seriesBody.Items[0] : null
  if (!series?.Id) return []

  const episodeBody = await jellyfinFetch(
    baseUrl,
    apiKey,
    `/Shows/${series.Id}/Episodes?Season=${season}&Fields=Path,MediaSources,IndexNumber`,
  )
  const items = Array.isArray(episodeBody?.Items) ? episodeBody.Items : []
  return items
    .filter((item) => item?.Id && Number.isFinite(Number(item.IndexNumber)))
    .map((item) => ({
      episode: Number(item.IndexNumber),
      match: jellyfinItemToMatch(item),
    }))
}

export async function fetchJellyfinFavorites({ baseUrl, apiKey }) {
  const body = await jellyfinFetch(
    baseUrl,
    apiKey,
    '/Users/Me/Items?Recursive=true&IncludeItemTypes=Movie,Series&Filters=IsFavorite&Fields=ProviderIds,Name,Type,ProductionYear,ImageTags',
  )
  const items = Array.isArray(body?.Items) ? body.Items : []
  return items
    .map((item) => {
      const imdbId = item.ProviderIds?.imdb || item.ProviderIds?.Imdb
      if (!imdbId) return null
      return {
        id: String(imdbId),
        type: item.Type === 'Series' ? 'series' : 'movie',
        name: item.Name || 'Unknown',
        releaseInfo: item.ProductionYear ? String(item.ProductionYear) : undefined,
      }
    })
    .filter(Boolean)
}

export function jellyfinPathForJob(job, { pathMapFrom, pathMapTo }) {
  const target = normalize(job.targetPath || '')
  const from = normalize(pathMapFrom || '')
  const to = normalize(pathMapTo || '/movies')
  if (target === from) return to
  if (target.startsWith(`${from}/`)) return `${to}${target.slice(from.length)}`
  return target
}

export async function findJellyfinItemForJob(job, { baseUrl, apiKey, pathMapFrom, pathMapTo }) {
  const jellyfinPath = jellyfinPathForJob(job, { pathMapFrom, pathMapTo })
  const targetPath = normalize(job.targetPath || '')
  const basenameName = basename(job.targetPath || '')
  const body = await jellyfinFetch(baseUrl, apiKey, '/Items?Recursive=true&IncludeItemTypes=Movie,Episode&Fields=Path&Limit=10000')
  const items = Array.isArray(body?.Items) ? body.Items : []
  const exact = items.find((item) => item.Path === jellyfinPath || (targetPath && item.Path === targetPath))
  if (exact) return exact
  if (basenameName) {
    return items.find((item) => item.Path?.endsWith(`/${basenameName}`) || item.Path?.endsWith(basenameName)) || null
  }
  return null
}

export async function verifyJellyfinImport({ baseUrl, apiKey, targetPath, pathMapFrom, pathMapTo }) {
  const target = normalize(String(targetPath || ''))
  if (!target) return null
  const from = normalize(String(pathMapFrom || ''))
  const to = normalize(String(pathMapTo || '/movies'))
  let mapped = target
  if (target === from) mapped = to
  else if (target.startsWith(`${from}/`)) mapped = `${to}${target.slice(from.length)}`
  const body = await jellyfinFetch(baseUrl, apiKey, '/Items?Recursive=true&IncludeItemTypes=Movie,Episode&Fields=Path&Limit=10000')
  const items = Array.isArray(body?.Items) ? body.Items : []
  const basenameName = basename(target)
  const exact = items.find((item) => item.Path === mapped || item.Path === target)
  if (exact) return { itemId: exact.Id || '', path: exact.Path || '' }
  if (basenameName) {
    const fuzzy = items.find((item) => item.Path?.endsWith(`/${basenameName}`) || item.Path?.endsWith(basenameName))
    if (fuzzy) return { itemId: fuzzy.Id || '', path: fuzzy.Path || '' }
  }
  return null
}

export async function refreshJellyfin({ baseUrl, apiKey }) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  if (!base) return
  await jellyfinFetch(base, apiKey, '/Library/Refresh', { method: 'POST' })
}

export async function waitForJellyfinImport(job, config, { sleep, appendJobLog }) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const item = await findJellyfinItemForJob(job, config).catch((error) => {
      if (appendJobLog) appendJobLog(job, 'jellyfin.verify.failed', { error: error.message })
      return null
    })
    if (item) return item
    await sleep(attempt < 2 ? 1000 : 2500)
  }
  return null
}
