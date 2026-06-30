export const ALLOWED_FETCH_HOSTS = [
  'v3-cinemeta.strem.io',
  'caching.stremio.net',
  'torrentio.strem.fun',
  'comet.elfhosted.com',
  'mediafusion.elfhosted.com',
  'api.torbox.app',
]

const VIDEO_FILENAME_PATTERN = /\.(mkv|mp4|avi|mov|webm|m4v)$/i
const TORRENT_APPEAR_TIMEOUT_MS = 120_000
const TORRENT_READY_TIMEOUT_MS = 180_000
const TORRENT_POLL_INTERVAL_MS = 2_000
const DOWNLOAD_LINK_ATTEMPTS = 5

function bodyDetail(body) {
  if (!body || typeof body !== 'object') return ''
  return body.detail || body.error || body.message || body.msg || ''
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isQueuedTorrentDetail(detail) {
  const message = String(detail || '').toLowerCase()
  return message.includes('queued') || message.includes('notification when it is processed')
}

export function isRetriableTorboxError(message) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('there was an error processing your request')
    || text.includes('please try again later')
    || text.includes('internal server error')
    || text.includes('bad gateway')
    || text.includes('service unavailable')
    || text.includes('gateway timeout')
    || /^5\d\d/.test(text)
  )
}

export function extractTorrentId(body) {
  if (!body || typeof body !== 'object') return null
  const candidates = [
    body?.data?.torrent_id,
    body?.data?.id,
    body?.torrent_id,
    body?.id,
  ]
  for (const candidate of candidates) {
    const parsed = Number(candidate)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

export function isTorrentCached(torrent) {
  if (!torrent || typeof torrent !== 'object') return false
  if (torrent.cached === true) return true
  const state = String(torrent.download_state || torrent.state || '').toLowerCase()
  return state.includes('cached') || state.includes('completed') || state.includes('complete')
}

function torrentFiles(torrent) {
  return torrent?.files || torrent?.file || torrent?.filelist || torrent?.contents || []
}

export function hasSelectableVideoFile(torrent) {
  const files = torrentFiles(torrent)
  if (!Array.isArray(files)) return false
  return files.some((file) => isVideoFilename(fileName(file)) && numericFileId(file) !== null)
}

async function torboxFetch(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  const detail = bodyDetail(body)
  if (!response.ok || body?.success === false) {
    throw new Error(detail || (typeof body === 'string' ? body : `${response.status} ${response.statusText}`))
  }
  return body
}

async function fetchJson(url, options = {}) {
  return torboxFetch(url, options)
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
  const files = torrentFiles(torrent)
  if (!Array.isArray(files)) return 0

  const indexed = Number.isFinite(fileIdx) ? files[Number(fileIdx)] : null
  if (indexed && isVideoFilename(fileName(indexed)) && numericFileId(indexed) !== null) {
    return numericFileId(indexed) ?? 0
  }

  if (filename) {
    const needle = String(filename).toLowerCase()
    const matched = files.find((file) => {
      const name = fileName(file).toLowerCase()
      return isVideoFilename(name) && (needle.includes(name) || name.includes(needle))
    })
    if (matched && numericFileId(matched) !== null) return numericFileId(matched) ?? 0
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

async function findTorrentByHash(token, hash, bypassCache = false) {
  const url = new URL('https://api.torbox.app/v1/api/torrents/mylist')
  if (bypassCache) url.searchParams.set('bypass_cache', 'true')
  url.searchParams.set('limit', '1000')
  const body = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const torrents = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
  const wanted = hash.toLowerCase()
  const found = torrents.find((torrent) => {
    const candidates = [torrent.hash, torrent.info_hash, torrent.infoHash, torrent.torrent_hash]
    return candidates.some((candidate) => String(candidate || '').toLowerCase() === wanted)
  })
  const id = found?.id ?? found?.torrent_id ?? found?.torrentId
  const parsed = Number(id)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

async function waitForTorrentByHash(token, hash, timeoutMs = TORRENT_APPEAR_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const id = await findTorrentByHash(token, hash, true)
    if (id) return id
    await sleep(TORRENT_POLL_INTERVAL_MS)
  }
  return null
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
  let id = extractTorrentId(body)
  if (!id) id = await waitForTorrentByHash(token, hash)
  if (!id) {
    const detail = bodyDetail(body)
    if (isQueuedTorrentDetail(detail)) {
      throw new Error('Torbox queued this torrent but it did not appear in your library in time. Try again shortly.')
    }
    throw new Error(detail || 'Torbox did not return a torrent id.')
  }
  return id
}

async function getTorrent(token, torrentId, bypassCache = false) {
  const url = new URL('https://api.torbox.app/v1/api/torrents/mylist')
  url.searchParams.set('id', String(torrentId))
  if (bypassCache) url.searchParams.set('bypass_cache', 'true')
  const body = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  return Array.isArray(body?.data) ? body.data[0] : body?.data || body
}

async function waitForTorrentReady(token, torrentId) {
  const deadline = Date.now() + TORRENT_READY_TIMEOUT_MS
  let lastState = ''
  while (Date.now() < deadline) {
    const torrent = await getTorrent(token, torrentId, true)
    lastState = String(torrent?.download_state || torrent?.state || '')
    const state = lastState.toLowerCase()
    if (state.includes('error') || state.includes('failed')) {
      throw new Error('Torbox reported an error caching this torrent. Try another result.')
    }
    if (isTorrentCached(torrent) && hasSelectableVideoFile(torrent)) return torrent
    if (isTorrentCached(torrent) && torrentFiles(torrent).length > 0) return torrent
    await sleep(TORRENT_POLL_INTERVAL_MS)
  }
  throw new Error(
    lastState
      ? `Torbox is still preparing this torrent (${lastState}). Wait a moment and try again.`
      : 'Torbox is still preparing this torrent. Wait a moment and try again.',
  )
}

function extractDownloadUrl(body) {
  if (typeof body?.data === 'string') return body.data
  const data = body?.data && typeof body.data === 'object' ? body.data : body
  for (const key of ['download_url', 'downloadUrl', 'url', 'link', 'download', 'redirect']) {
    if (typeof data?.[key] === 'string') return data[key]
  }
  throw new Error(bodyDetail(body) || 'Torbox did not return a direct download URL.')
}

async function requestDownloadLinkOnce(token, torrentId, fileId) {
  const url = new URL('https://api.torbox.app/v1/api/torrents/requestdl')
  url.searchParams.set('token', token)
  url.searchParams.set('torrent_id', String(torrentId))
  url.searchParams.set('file_id', String(fileId || 0))
  url.searchParams.set('zip_link', 'false')
  url.searchParams.set('redirect', 'false')
  url.searchParams.set('append_name', 'false')
  return extractDownloadUrl(await fetchJson(url.toString()))
}

async function requestDownloadLink(token, torrentId, fileId) {
  let lastError = null
  for (let attempt = 1; attempt <= DOWNLOAD_LINK_ATTEMPTS; attempt += 1) {
    try {
      return await requestDownloadLinkOnce(token, torrentId, fileId)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!isRetriableTorboxError(message) || attempt === DOWNLOAD_LINK_ATTEMPTS) throw error
      await sleep(attempt * 1500)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Torbox did not return a direct download URL.')
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
  const existingTorrentId = await findTorrentByHash(cleanToken, hash, true)
  const torrentId = existingTorrentId || (await createTorrent(cleanToken, hash, filename))
  const torrent = await waitForTorrentReady(cleanToken, torrentId)
  const fileId = chooseFileId(torrent, Number(fileIdx), filename)
  return requestDownloadLink(cleanToken, torrentId, fileId)
}
