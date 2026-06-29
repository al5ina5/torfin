export const ALLOWED_FETCH_HOSTS = [
  'v3-cinemeta.strem.io',
  'torrentio.strem.fun',
  'comet.elfhosted.com',
  'mediafusion.elfhosted.com',
  'api.torbox.app',
]

const VIDEO_FILENAME_PATTERN = /\.(mkv|mp4|avi|mov|webm|m4v)$/i

function bodyDetail(body) {
  if (!body || typeof body !== 'object') return ''
  return body.detail || body.error || body.message || body.msg || ''
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    throw new Error(bodyDetail(body) || (typeof body === 'string' ? body : `${response.status} ${response.statusText}`))
  }
  return body
}

export function extractInfoHash(value) {
  const match = String(value || '').match(/btih:([^&?/]+)/i)
  return match?.[1]
}

function fileName(file) {
  return String(file?.name || file?.short_name || file?.path || file?.filename || '')
}

function fileSize(file) {
  return Number(file?.size || file?.bytes || file?.length || 0)
}

function numericFileId(file) {
  const value = file?.id ?? file?.file_id ?? file?.fileId ?? file?.idx ?? file?.index
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function isVideoFilename(name) {
  return VIDEO_FILENAME_PATTERN.test(String(name || ''))
}

export function chooseFileId(torrent, fileIdx, filename) {
  const files = torrent?.files || torrent?.file || torrent?.filelist || torrent?.contents || []
  if (!Array.isArray(files)) return 0

  const indexed = Number.isFinite(fileIdx) ? files[Number(fileIdx)] : null
  if (indexed && isVideoFilename(fileName(indexed)) && numericFileId(indexed) !== null) {
    return numericFileId(indexed)
  }

  if (filename) {
    const needle = String(filename).toLowerCase()
    const matched = files.find((file) => {
      const name = fileName(file).toLowerCase()
      return isVideoFilename(name) && (needle.includes(name) || name.includes(needle))
    })
    if (matched && numericFileId(matched) !== null) return numericFileId(matched)
  }

  const bestVideo = files
    .filter((file) => isVideoFilename(fileName(file)) && numericFileId(file) !== null)
    .sort((a, b) => fileSize(b) - fileSize(a))[0]

  return numericFileId(bestVideo) ?? numericFileId(indexed) ?? numericFileId(files[0]) ?? 0
}

function isAllowedHost(hostname) {
  const lowerHost = String(hostname || '').toLowerCase()
  if (lowerHost === 'strem.io' || lowerHost.endsWith('.strem.io')) return true
  return ALLOWED_FETCH_HOSTS.includes(lowerHost)
}

export function normalizeAllowedFetchJsonUrl(value) {
  const url = new URL(String(value || '').trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('JSON fetches only support HTTP and HTTPS URLs.')
  }
  if (!isAllowedHost(url.hostname)) {
    throw new Error(`Host ${url.hostname} is not in the JSON fetch allowlist.`)
  }
  return url.toString()
}

async function findTorrentByHash(token, hash) {
  const body = await fetchJson('https://api.torbox.app/v1/api/torrents/mylist', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const torrents = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
  const wanted = hash.toLowerCase()
  const found = torrents.find((torrent) => {
    const candidates = [torrent.hash, torrent.info_hash, torrent.infoHash, torrent.torrent_hash]
    return candidates.some((candidate) => String(candidate || '').toLowerCase() === wanted)
  })
  return found?.id ?? found?.torrent_id ?? found?.torrentId
}

async function createTorrent(token, hash, name) {
  const form = new FormData()
  form.set('magnet', `magnet:?xt=urn:btih:${hash}`)
  form.set('seed', '1')
  form.set('allow_zip', 'false')
  form.set('as_queued', 'false')
  if (name) form.set('name', name)
  const body = await fetchJson('https://api.torbox.app/v1/api/torrents/createtorrent', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const id = body?.data?.id ?? body?.data?.torrent_id ?? body?.id ?? body?.torrent_id
  if (!id) throw new Error(bodyDetail(body) || 'Torbox did not return a torrent id.')
  return id
}

async function getTorrent(token, torrentId) {
  const body = await fetchJson(`https://api.torbox.app/v1/api/torrents/mylist?id=${encodeURIComponent(torrentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return Array.isArray(body?.data) ? body.data[0] : body?.data || body
}

function extractDownloadUrl(body) {
  if (typeof body?.data === 'string') return body.data
  const data = body?.data && typeof body.data === 'object' ? body.data : body
  for (const key of ['download_url', 'downloadUrl', 'url', 'link', 'download', 'redirect']) {
    if (typeof data?.[key] === 'string') return data[key]
  }
  throw new Error(bodyDetail(body) || 'Torbox did not return a direct download URL.')
}

async function requestDownloadLink(token, torrentId, fileId) {
  const url = new URL('https://api.torbox.app/v1/api/torrents/requestdl')
  url.searchParams.set('token', token)
  url.searchParams.set('torrent_id', String(torrentId))
  url.searchParams.set('file_id', String(fileId || 0))
  url.searchParams.set('zip_link', 'false')
  url.searchParams.set('redirect', 'false')
  url.searchParams.set('append_name', 'false')
  return extractDownloadUrl(await fetchJson(url.toString()))
}

function stringField(body, keys) {
  for (const key of keys) {
    const value = body?.[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function numberField(body, keys) {
  for (const key of keys) {
    const value = body?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

function planLabel(planId) {
  if (planId === 0) return 'Free'
  if (planId === 1) return 'Essential'
  if (planId === 2) return 'Pro'
  if (planId === 3) return 'Standard'
  return `Plan ${planId}`
}

export async function fetchTorboxAccount(token) {
  const apiKey = String(token || '').trim()
  if (!apiKey) throw new Error('Add your Torbox API key to load account details.')

  const userBody = await fetchJson('https://api.torbox.app/v1/api/user/me', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const user = userBody?.data && typeof userBody.data === 'object' ? userBody.data : userBody
  const planId = numberField(user, ['plan', 'plan_id', 'planId'])
  const premium = typeof user?.premium === 'boolean'
    ? user.premium
    : typeof user?.is_premium === 'boolean'
      ? user.is_premium
      : (planId ?? 0) > 0

  let torrents = []
  try {
    const torrentBody = await fetchJson('https://api.torbox.app/v1/api/torrents/mylist', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    torrents = Array.isArray(torrentBody?.data) ? torrentBody.data : Array.isArray(torrentBody) ? torrentBody : []
  } catch {
    torrents = []
  }

  let activeTorrents = 0
  let cachedTorrents = 0
  for (const entry of torrents) {
    const state = String(entry?.download_state || entry?.state || '').toLowerCase()
    if (state.includes('cached') || entry?.cached === true) cachedTorrents += 1
    if (state && !['completed', 'complete', 'cached', 'error'].some((item) => state.includes(item))) {
      activeTorrents += 1
    }
  }

  return {
    email: stringField(user, ['email', 'user_email']),
    plan: stringField(user, ['plan_name', 'planName']) || (planId !== undefined ? planLabel(planId) : undefined),
    planId,
    premium,
    expiresAt: stringField(user, ['premium_expires_at', 'expires_at', 'expiration']),
    totalTorrents: torrents.length,
    activeTorrents,
    cachedTorrents,
  }
}

export async function resolveTorboxStream({ token, infoHash, fileIdx, filename, directUrl }) {
  if (directUrl && /^https?:\/\//.test(directUrl)) return directUrl
  const hash = infoHash || extractInfoHash(directUrl)
  if (!hash) throw new Error('This stream does not expose an info hash or playable URL.')
  if (!String(token || '').trim()) throw new Error('Add your Torbox API key before resolving Torbox results.')
  const cleanToken = token.trim()
  const existingTorrentId = await findTorrentByHash(cleanToken, hash)
  const torrentId = existingTorrentId || (await createTorrent(cleanToken, hash, filename))
  const torrent = await getTorrent(cleanToken, torrentId)
  const fileId = chooseFileId(torrent, Number(fileIdx), filename)
  return requestDownloadLink(cleanToken, torrentId, fileId)
}
