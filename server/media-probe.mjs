import { execFileSync } from 'node:child_process'

import { findFfprobe, isRemoteUrl, PROXY_USER_AGENT } from './ffmpeg-bin.mjs'

function ffprobeHttpArgs() {
  return ['-user_agent', PROXY_USER_AGENT]
}

function trackLabel(stream, kind, ordinal) {
  const tags = stream.tags || {}
  const title = tags.title?.trim()
  const language = tags.language?.trim()
  const fallback = kind === 'audio' ? `Audio ${ordinal}` : `Subtitles ${ordinal}`
  return title || language || fallback
}

function parseProbeJson(body) {
  const durationRaw = body.format?.duration
  const duration = Number.parseFloat(String(durationRaw ?? ''))
  const formatName = body.format?.format_name?.trim() || undefined

  let videoCodec = null
  const audioCodecs = []
  const audioTracks = []
  const subtitleTracks = []

  for (const stream of body.streams || []) {
    const index = stream.index
    if (index === undefined || index === null) continue

    const codecType = stream.codec_type || ''
    const codec = stream.codec_name?.trim() || undefined

    if (codecType === 'video') {
      if (!videoCodec && codec) videoCodec = codec
      continue
    }

    if (codecType !== 'audio' && codecType !== 'subtitle') continue

    const track = {
      index,
      kind: codecType,
      label: trackLabel(stream, codecType, codecType === 'audio' ? audioTracks.length + 1 : subtitleTracks.length + 1),
      language: stream.tags?.language?.trim() || undefined,
      codec,
    }

    if (codecType === 'audio') {
      if (codec && !audioCodecs.includes(codec)) audioCodecs.push(codec)
      audioTracks.push(track)
      continue
    }

    subtitleTracks.push(track)
  }

  return {
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    formatName,
    videoCodec: videoCodec || undefined,
    audioCodecs,
    audioTracks,
    subtitleTracks,
  }
}

export function probeMedia(sourceUrl) {
  const ffprobe = findFfprobe()
  if (!ffprobe) {
    throw new Error('FFprobe is not available. Install FFmpeg on this host.')
  }

  const args = [
    '-v', 'error',
    '-print_format', 'json',
    '-show_entries', 'format=duration,format_name:stream=index,codec_type,codec_name:stream_tags=language,title',
  ]

  if (isRemoteUrl(sourceUrl)) {
    args.push(...ffprobeHttpArgs())
  }

  args.push('-i', sourceUrl)

  const output = execFileSync(ffprobe, args, { encoding: 'utf8', timeout: 45000 })
  const body = JSON.parse(output)
  return parseProbeJson(body)
}

export function probeDuration(sourceUrl) {
  try {
    return probeMedia(sourceUrl).duration ?? null
  } catch {
    return null
  }
}
