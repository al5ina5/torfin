import { isTauriRuntime, postApi } from './api'
import type { ContentType, JellyfinLibraryMatch, Movie, StreamResult } from '../types'

type LookupArgs = {
  baseUrl: string
  apiKey: string
  imdbId: string
  contentType: ContentType
  season?: number
  episode?: number
}

type BatchLookupItem = {
  key: string
  imdbId: string
  contentType: ContentType
}

export function jellyfinLibraryKey(contentType: ContentType, imdbId: string) {
  return `${contentType}:${imdbId}`
}

function streamQualityFromText(text: string) {
  const haystack = text.toLowerCase()
  if (haystack.includes('2160') || haystack.includes('4k') || haystack.includes('uhd')) return 2160
  if (haystack.includes('1080')) return 1080
  if (haystack.includes('720')) return 720
  if (haystack.includes('480')) return 480
  return 0
}

export function streamTargetQuality(stream: StreamResult) {
  return streamQualityFromText(`${stream.title} ${stream.description ?? ''}`)
}

export function compareQuality(existingHeight: number, targetQuality: number) {
  if (!existingHeight || !targetQuality) return { isUpgrade: false, label: existingHeight ? `${existingHeight}p` : 'In library' }
  const isUpgrade = targetQuality > existingHeight
  const label = existingHeight >= 2160 ? '4K' : `${existingHeight}p`
  return { isUpgrade, label }
}

export async function lookupJellyfinLibrary(args: LookupArgs): Promise<JellyfinLibraryMatch | null> {
  const { baseUrl, apiKey, imdbId, contentType, season, episode } = args
  if (!baseUrl.trim() || !apiKey.trim() || !imdbId.trim()) return null

  const tauri = isTauriRuntime()
  const result = tauri
    ? await import('@tauri-apps/api/core').then(({ invoke }) =>
        invoke<JellyfinLibraryMatch | null>('lookup_jellyfin_library', {
          baseUrl,
          apiKey,
          imdbId,
          contentType,
          season: season ?? null,
          episode: episode ?? null,
        }),
      )
    : await postApi<JellyfinLibraryMatch | null>('/api/jellyfin/lookup', {
        baseUrl,
        apiKey,
        imdbId,
        contentType,
        season,
        episode,
      })

  return result ?? null
}

export function jellyfinPlayUrl(baseUrl: string, itemId: string) {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base || !itemId) return ''
  return `${base}/web/index.html#!/details?id=${encodeURIComponent(itemId)}`
}

export async function batchLookupJellyfinLibrary(args: {
  baseUrl: string
  apiKey: string
  items: BatchLookupItem[]
}): Promise<Record<string, JellyfinLibraryMatch | null>> {
  const { baseUrl, apiKey, items } = args
  if (!baseUrl.trim() || !apiKey.trim() || !items.length) return {}

  if (!isTauriRuntime()) {
    return postApi<Record<string, JellyfinLibraryMatch | null>>('/api/jellyfin/batch-lookup', {
      baseUrl,
      apiKey,
      items,
    })
  }

  const matches: Record<string, JellyfinLibraryMatch | null> = {}
  const concurrency = 4
  let index = 0
  async function worker() {
    while (index < items.length) {
      const current = items[index]
      index += 1
      if (!current) continue
      matches[current.key] = await lookupJellyfinLibrary({
        baseUrl,
        apiKey,
        imdbId: current.imdbId,
        contentType: current.contentType,
      })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return matches
}

export async function lookupJellyfinSeasonEpisodes(args: {
  baseUrl: string
  apiKey: string
  imdbId: string
  season: number
}): Promise<Array<{ episode: number; match: JellyfinLibraryMatch }>> {
  const { baseUrl, apiKey, imdbId, season } = args
  if (!baseUrl.trim() || !apiKey.trim() || !imdbId.trim()) return []

  if (!isTauriRuntime()) {
    return postApi<Array<{ episode: number; match: JellyfinLibraryMatch }>>('/api/jellyfin/season-episodes', {
      baseUrl,
      apiKey,
      imdbId,
      season,
    })
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<Array<{ episode: number; match: JellyfinLibraryMatch }>>('lookup_jellyfin_season_episodes', {
    baseUrl,
    apiKey,
    imdbId,
    season,
  }).catch(() => [])
}

export async function fetchJellyfinFavorites(args: {
  baseUrl: string
  apiKey: string
}): Promise<Movie[]> {
  const { baseUrl, apiKey } = args
  if (!baseUrl.trim() || !apiKey.trim()) return []

  if (!isTauriRuntime()) {
    const items = await postApi<Array<{ id: string; type: ContentType; name: string; releaseInfo?: string }>>(
      '/api/jellyfin/favorites',
      { baseUrl, apiKey },
    )
    return items.map((item) => ({ ...item, type: item.type === 'series' ? 'series' : 'movie' }))
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const items = await invoke<Array<{ id: string; type: string; name: string; releaseInfo?: string }>>('fetch_jellyfin_favorites', {
    baseUrl,
    apiKey,
  }).catch(() => [])
  return items.map((item) => ({
    id: item.id,
    type: item.type === 'series' ? 'series' : 'movie',
    name: item.name,
    releaseInfo: item.releaseInfo,
  }))
}
