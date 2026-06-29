export const ALLOWED_FETCH_HOSTS = [
  'v3-cinemeta.strem.io',
  'torrentio.strem.fun',
  'comet.elfhosted.com',
  'mediafusion.elfhosted.com',
  'api.torbox.app',
] as const

const VIDEO_FILENAME_PATTERN = /\.(mkv|mp4|avi|mov|webm|m4v)$/i

export type TorboxResolveInput = {
  token: string
  infoHash?: string | null
  fileIdx?: number | null
  filename?: string | null
  directUrl?: string | null
}

type TorboxTorrentFile = {
  id?: number | string
  file_id?: number | string
  fileId?: number | string
  idx?: number | string
  index?: number | string
  name?: string
  short_name?: string
  path?: string
  filename?: string
  size?: number | string
  bytes?: number | string
  length?: number | string
}

type TorboxTorrent = {
  id?: number | string
  torrent_id?: number | string
  torrentId?: number | string
  hash?: string
  info_hash?: string
  infoHash?: string
  torrent_hash?: string
  files?: TorboxTorrentFile[]
  file?: TorboxTorrentFile[]
  filelist?: TorboxTorrentFile[]
  contents?: TorboxTorrentFile[]
}

function asId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  return null
}

function bodyDetail(body: unknown) {
  if (!body || typeof body !== 'object') return ''
  const maybeBody = body as Record<string, unknown>
  const detail = maybeBody.detail || maybeBody.error || maybeBody.message || maybeBody.msg
  return typeof detail === 'string' ? detail : ''
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    if (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string') {
      throw new Error(body.message)
    }
    throw new Error(bodyDetail(body) || (typeof body === 'string' ? body : `${response.status} ${response.statusText}`))
  }
  return body
}

export function extractInfoHash(value: string | null | undefined) {
  const match = String(value || '').match(/btih:([^&?/]+)/i)
  return match?.[1]
}

function fileName(file: TorboxTorrentFile | null | undefined) {
  return String(file?.name || file?.short_name || file?.path || file?.filename || '')
}

function fileSize(file: TorboxTorrentFile | null | undefined) {
  return Number(file?.size || file?.bytes || file?.length || 0)
}

function numericFileId(file: TorboxTorrentFile | null | undefined) {
  const value = file?.id ?? file?.file_id ?? file?.fileId ?? file?.idx ?? file?.index
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function isVideoFilename(name: string | null | undefined) {
  return VIDEO_FILENAME_PATTERN.test(String(name || ''))
}

export function chooseFileId(torrent: TorboxTorrent | null | undefined, fileIdx?: number | null, filename?: string | null) {
  const files = torrent?.files || torrent?.file || torrent?.filelist || torrent?.contents || []
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

function isAllowedHost(hostname: string) {
  const lowerHost = hostname.toLowerCase()
  if (lowerHost === 'strem.io' || lowerHost.endsWith('.strem.io')) return true
  return ALLOWED_FETCH_HOSTS.includes(lowerHost as (typeof ALLOWED_FETCH_HOSTS)[number])
}

export function normalizeAllowedFetchJsonUrl(value: string | null | undefined) {
  const url = new URL(String(value || '').trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('JSON fetches only support HTTP and HTTPS URLs.')
  }
  if (!isAllowedHost(url.hostname)) {
    throw new Error(`Host ${url.hostname} is not in the JSON fetch allowlist.`)
  }
  return url.toString()
}

async function findTorrentByHash(token: string, hash: string) {
  const body = await fetchJson('https://api.torbox.app/v1/api/torrents/mylist', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const torrents = Array.isArray((body as { data?: unknown[] })?.data)
    ? (body as { data: TorboxTorrent[] }).data
    : Array.isArray(body)
      ? (body as TorboxTorrent[])
      : []
  const wanted = hash.toLowerCase()
  const found = torrents.find((torrent) => {
    const candidates = [torrent.hash, torrent.info_hash, torrent.infoHash, torrent.torrent_hash]
    return candidates.some((candidate) => String(candidate || '').toLowerCase() === wanted)
  })
  return asId(found?.id) ?? asId(found?.torrent_id) ?? asId(found?.torrentId)
}

async function createTorrent(token: string, hash: string, name?: string | null) {
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
  const bodyRecord = body as { data?: Record<string, unknown>; id?: unknown; torrent_id?: unknown }
  const id = asId(bodyRecord.data?.id) ?? asId(bodyRecord.data?.torrent_id) ?? asId(bodyRecord.id) ?? asId(bodyRecord.torrent_id)
  if (!id) throw new Error(bodyDetail(body) || 'Torbox did not return a torrent id.')
  return id
}

async function getTorrent(token: string, torrentId: string | number) {
  const body = await fetchJson(`https://api.torbox.app/v1/api/torrents/mylist?id=${encodeURIComponent(torrentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (Array.isArray((body as { data?: unknown[] })?.data)) {
    return (body as { data: TorboxTorrent[] }).data[0]
  }
  const data = (body as { data?: TorboxTorrent }).data
  return (data || body) as TorboxTorrent
}

function extractDownloadUrl(body: unknown) {
  if (typeof (body as { data?: unknown })?.data === 'string') return (body as { data: string }).data
  const data = (body as { data?: unknown })?.data
  const from = data && typeof data === 'object' ? (data as Record<string, unknown>) : (body as Record<string, unknown>)
  for (const key of ['download_url', 'downloadUrl', 'url', 'link', 'download', 'redirect']) {
    if (typeof from?.[key] === 'string') return from[key]
  }
  throw new Error(bodyDetail(body) || 'Torbox did not return a direct download URL.')
}

async function requestDownloadLink(token: string, torrentId: string | number, fileId: number) {
  const url = new URL('https://api.torbox.app/v1/api/torrents/requestdl')
  url.searchParams.set('token', token)
  url.searchParams.set('torrent_id', String(torrentId))
  url.searchParams.set('file_id', String(fileId || 0))
  url.searchParams.set('zip_link', 'false')
  url.searchParams.set('redirect', 'false')
  url.searchParams.set('append_name', 'false')
  return extractDownloadUrl(await fetchJson(url.toString()))
}

export async function resolveTorboxStream({ token, infoHash, fileIdx, filename, directUrl }: TorboxResolveInput) {
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
