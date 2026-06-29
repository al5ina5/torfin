import type { StreamResult } from '../types'

function streamText(stream: StreamResult) {
  return `${stream.title}\n${stream.description ?? ''}`
}

function streamSizeGb(stream: StreamResult) {
  const haystack = streamText(stream)
  const gbMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:gb|gib)/i)
  if (gbMatch?.[1]) return Number(gbMatch[1].replace(',', '.'))
  const mbMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:mb|mib)/i)
  if (mbMatch?.[1]) return Number(mbMatch[1].replace(',', '.')) / 1024
  return Number.POSITIVE_INFINITY
}

function streamPeers(stream: StreamResult) {
  const haystack = streamText(stream)
  const emojiMatch = haystack.match(/(?:👤|👥)\s*(\d[\d,]*)/u)
  if (emojiMatch?.[1]) return Number(emojiMatch[1].replace(/,/g, ''))
  const wordMatch = haystack.match(/\b(?:seeders|seeds|peers)\D{0,12}(\d[\d,]*)/i)
  if (wordMatch?.[1]) return Number(wordMatch[1].replace(/,/g, ''))
  return Number.NaN
}

function streamQuality(stream: StreamResult) {
  const haystack = streamText(stream).toLowerCase()
  if (haystack.includes('2160') || haystack.includes('4k') || haystack.includes('uhd')) return 2160
  if (haystack.includes('1080')) return 1080
  if (haystack.includes('720')) return 720
  if (haystack.includes('480')) return 480
  return 0
}

export function streamQualityLabel(stream: StreamResult) {
  const detailTags = stream.tags.filter((tag) => tag !== 'Torbox')
  if (detailTags.length) return detailTags.slice(0, 3).join(' ')
  const quality = streamQuality(stream)
  return quality ? `${quality}p` : 'Unknown'
}

export function streamSizeLabel(stream: StreamResult) {
  const size = streamSizeGb(stream)
  return Number.isFinite(size) ? `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} GB` : 'Unknown'
}

export function streamPeersLabel(stream: StreamResult) {
  const peers = streamPeers(stream)
  return Number.isFinite(peers) ? peers.toLocaleString() : 'Unknown'
}

const RELEASE_NOISE =
  /\b(?:2160p|1080p|720p|480p|576p|4k|uhd|web-?dl|webrip|bluray|blu-?ray|remux|complete|proper|repack|extended|unrated|dual|multi|h\.?26[45]|x26[45]|hevc|avc|aac|ac3|eac3|ddp?5?\.?1|dd|atmos|truehd|dts|dv|hdr10?\+?|sdr|10bit|8bit|yts|rarbg|hdtv|bdrip|dvdrip|cam|ts|hc|nf|amzn|atvp|hmax|p5|cached|instant|torbox)\b/gi

function humanizeReleaseName(raw: string) {
  const line = raw.split('\n')[0]?.trim() ?? raw
  const seasonMatch = line.match(/\bS(\d{1,2})\b/i)
  const yearMatch = line.match(/\b((?:19|20)\d{2})\b/)

  const working = line
    .replace(/[._]+/g, ' ')
    .replace(RELEASE_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const parts = working.split(' ').filter(Boolean)
  if (!parts.length) return line.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()

  const name = parts[0]
  if (seasonMatch) {
    return `${name} · S${seasonMatch[1].padStart(2, '0')}`
  }
  if (yearMatch && parts.length <= 3) {
    return `${name} (${yearMatch[1]})`
  }

  return parts.slice(0, Math.min(parts.length, 4)).join(' ')
}

export function compactStreamTitle(stream: StreamResult) {
  const metricsPattern = /(?:👤|👥|💾|⚙️).*$/gu
  const sourcePattern = /\b(?:seeders|seeds|peers|source)\b.*$/gi
  const cleaned = stream.title
    .split('\n')
    .map((line) => line.replace(metricsPattern, '').replace(sourcePattern, '').trim())
    .filter(Boolean)
    .join(' · ')

  const raw = cleaned || stream.title.replace(/\s+/g, ' ').trim()
  if (/[._]/.test(raw) || RELEASE_NOISE.test(raw)) {
    RELEASE_NOISE.lastIndex = 0
    return humanizeReleaseName(raw)
  }

  return raw
}

export function streamMetaSummary(stream: StreamResult) {
  const parts: string[] = []
  const quality = streamQualityLabel(stream)
  const size = streamSizeLabel(stream)
  const peers = streamPeers(stream)

  if (quality !== 'Unknown') parts.push(quality)
  if (size !== 'Unknown') parts.push(size)
  if (Number.isFinite(peers)) {
    parts.push(`${peers.toLocaleString()} peer${peers === 1 ? '' : 's'}`)
  }

  return parts.join(' · ')
}

export function streamSourceLabel(stream: StreamResult) {
  const match = streamText(stream).match(/(?:⚙️|source)\s*([^\n•]+)/i)
  return match?.[1]?.trim() || stream.pluginName
}

export function streamDirectUrl(stream: StreamResult) {
  return stream.url?.startsWith('http') && !stream.infoHash ? stream.url : undefined
}

export function streamNeedsTorboxResolve(stream: StreamResult) {
  if (streamDirectUrl(stream)) return false
  return Boolean(stream.infoHash || stream.url?.startsWith('magnet:') || stream.url?.startsWith('http'))
}

export function canPlayStream(stream: StreamResult, torboxApiKey: string) {
  if (streamDirectUrl(stream)) return true
  if (!streamNeedsTorboxResolve(stream)) return false
  return Boolean(torboxApiKey.trim())
}

export function downloadActionTitle(torboxApiKey: string, stream: StreamResult) {
  if (shouldExportTorrentLabel(torboxApiKey, stream)) return 'Save torrent file'
  return 'Import to library'
}

export function playActionTitle(stream: StreamResult, torboxApiKey: string) {
  if (canPlayStream(stream, torboxApiKey)) {
    return streamDirectUrl(stream) ? 'Play stream' : 'Play with debrid'
  }
  if (streamNeedsTorboxResolve(stream) && !streamDirectUrl(stream)) return 'Connect debrid in Settings to play'
  return 'No playable stream data'
}

function shouldExportTorrentLabel(torboxApiKey: string, stream: StreamResult) {
  return Boolean((stream.infoHash || stream.url?.startsWith('magnet:')) && !torboxApiKey.trim())
}

export function canDownload(stream: StreamResult) {
  return Boolean(stream.infoHash || stream.url?.startsWith('magnet:') || stream.url?.startsWith('http'))
}
