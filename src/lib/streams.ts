import type { CustomStreamProfile, ResultProfile, StreamResult } from '../types/index.js'

export function qualityRank(text: string) {
  const haystack = text.toLowerCase()
  let score = 0
  if (haystack.includes('2160') || haystack.includes('4k') || haystack.includes('uhd')) score += 70
  if (haystack.includes('1080')) score += 50
  if (haystack.includes('720')) score += 25
  if (haystack.includes('cached') || haystack.includes('instant') || haystack.includes('torbox')) score += 40
  if (haystack.includes('remux')) score += 18
  if (haystack.includes('bluray') || haystack.includes('blu-ray')) score += 14
  if (haystack.includes('web-dl') || haystack.includes('webrip')) score += 10
  const seeders = haystack.match(/(?:seeders|seeds|👤|👥)\D*(\d+)/)
  if (seeders?.[1]) score += Math.min(Number(seeders[1]) / 5, 30)
  return score
}

function tagsFor(text: string) {
  const tags = new Set<string>()
  const haystack = text.toLowerCase()
  if (haystack.includes('2160') || haystack.includes('4k')) tags.add('4K')
  if (haystack.includes('1080')) tags.add('1080p')
  if (haystack.includes('720')) tags.add('720p')
  if (haystack.includes('cached') || haystack.includes('instant') || haystack.includes('torbox')) tags.add('Torbox')
  if (haystack.includes('remux')) tags.add('Remux')
  if (haystack.includes('hdr')) tags.add('HDR')
  if (haystack.includes('dolby') || haystack.includes('atmos')) tags.add('Atmos')
  return Array.from(tags).slice(0, 4)
}

function streamText(stream: StreamResult) {
  return `${stream.title}\n${stream.description ?? ''}`
}

function streamQuality(stream: StreamResult) {
  const haystack = streamText(stream).toLowerCase()
  if (haystack.includes('2160') || haystack.includes('4k') || haystack.includes('uhd')) return 2160
  if (haystack.includes('1080')) return 1080
  if (haystack.includes('720')) return 720
  if (haystack.includes('480')) return 480
  return 0
}

function streamSizeGb(stream: StreamResult) {
  const haystack = streamText(stream)
  const gbMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:gb|gib)/i)
  if (gbMatch?.[1]) return Number(gbMatch[1].replace(',', '.'))

  const mbMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:mb|mib)/i)
  if (mbMatch?.[1]) return Number(mbMatch[1].replace(',', '.')) / 1024

  return Number.POSITIVE_INFINITY
}

function isCached(stream: StreamResult) {
  return /cached|instant|torbox/i.test(streamText(stream))
}

function isLowQualityCapture(stream: StreamResult) {
  return /\b(cam|camrip|ts|telesync|tc|telecine|hdcam|screener|scr)\b/i.test(streamText(stream))
}

function isThreeDimensional(stream: StreamResult) {
  return /\b(3d|sbs|half-sbs|hsbs|ou|half-ou)\b/i.test(streamText(stream))
}

function dedupeStreams(streams: StreamResult[]) {
  const seen = new Set<string>()
  return streams.filter((stream) => {
    const key = `${stream.pluginName}:${streamQuality(stream)}:${stream.title}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 180)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function filterStreamsForProfile(
  streams: StreamResult[],
  profile: ResultProfile,
  preferCachedResults: boolean,
  customProfile?: CustomStreamProfile,
) {
  if (customProfile) return filterStreamsForCustomProfile(streams, customProfile)

  const clean = streams.filter((stream) => !isLowQualityCapture(stream) && !isThreeDimensional(stream))
  const cached = clean.filter(isCached)
  const base = preferCachedResults && cached.length ? cached : clean

  if (profile === 'netflix') {
    const byQuality = new Map<number, StreamResult>()

    base
      .filter((stream) => streamQuality(stream) >= 720)
      .forEach((stream) => {
        const quality = streamQuality(stream)
        const current = byQuality.get(quality)
        if (!current || stream.rank > current.rank) byQuality.set(quality, stream)
      })

    return Array.from(byQuality.values())
      .sort((a, b) => streamQuality(b) - streamQuality(a) || b.rank - a.rank)
      .slice(0, 4)
  }

  if (profile === 'dataSaver') {
    return dedupeStreams(base)
      .filter((stream) => {
        const quality = streamQuality(stream)
        const size = streamSizeGb(stream)
        return quality <= 1080 && (size <= 15 || !Number.isFinite(size))
      })
      .sort((a, b) => {
        const qualityDelta = streamQuality(b) - streamQuality(a)
        if (qualityDelta !== 0) return qualityDelta
        return streamSizeGb(a) - streamSizeGb(b) || b.rank - a.rank
      })
      .slice(0, 6)
  }

  return dedupeStreams(base)
    .filter((stream) => streamQuality(stream) >= 1080 || /hdr|remux|bluray|blu-ray|atmos/i.test(streamText(stream)))
    .sort((a, b) => b.rank - a.rank || streamSizeGb(b) - streamSizeGb(a))
    .slice(0, 8)
}

export function filterStreamsForCustomProfile(streams: StreamResult[], profile: CustomStreamProfile) {
  let base = streams
  if (profile.hideCam) base = base.filter((stream) => !isLowQualityCapture(stream))
  if (profile.hide3d) base = base.filter((stream) => !isThreeDimensional(stream))

  const cached = base.filter(isCached)
  if (profile.preferCached && cached.length) base = cached

  base = base.filter((stream) => {
    const quality = streamQuality(stream)
    if (profile.minResolution && quality > 0 && quality < profile.minResolution) return false
    if (profile.maxResolution && quality > profile.maxResolution) return false
    if (profile.maxFileSizeGb > 0) {
      const size = streamSizeGb(stream)
      if (Number.isFinite(size) && size > profile.maxFileSizeGb) return false
    }
    return true
  })

  const ranked = dedupeStreams(base).sort((a, b) => b.rank - a.rank || streamSizeGb(b) - streamSizeGb(a))

  if (profile.onePerResolution) {
    const byQuality = new Map<number, StreamResult>()
    ranked.forEach((stream) => {
      const quality = streamQuality(stream)
      const current = byQuality.get(quality)
      if (!current || stream.rank > current.rank) byQuality.set(quality, stream)
    })
    return Array.from(byQuality.values())
      .sort((a, b) => streamQuality(b) - streamQuality(a) || b.rank - a.rank)
      .slice(0, profile.maxResults)
  }

  return ranked.slice(0, profile.maxResults)
}

export function normalizeStreams(pluginName: string, payload: unknown): StreamResult[] {
  const streams = (payload as { streams?: Array<Record<string, unknown>> }).streams ?? []

  return streams.map((stream) => {
    const title = String(stream.title || stream.name || stream.description || 'Untitled result')
    const description = stream.description ? String(stream.description) : undefined
    const combined = `${title}\n${description ?? ''}`
    const rank = qualityRank(combined)

    return {
      pluginName,
      title,
      description,
      url: typeof stream.url === 'string' ? stream.url : undefined,
      externalUrl: typeof stream.externalUrl === 'string' ? stream.externalUrl : undefined,
      infoHash: typeof stream.infoHash === 'string' ? stream.infoHash : undefined,
      fileIdx: typeof stream.fileIdx === 'number' ? stream.fileIdx : undefined,
      rank,
      tags: tagsFor(combined),
    }
  })
}
