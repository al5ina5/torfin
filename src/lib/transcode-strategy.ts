export type TranscodeMode = 'copy' | 'remux' | 'transcode'

type TrackLike = {
  index: number
  codec?: string
}

type MediaInfoLike = {
  videoCodec?: string
  audioTracks: TrackLike[]
  subtitleTracks: TrackLike[]
}

const H264_CODECS = new Set(['h264', 'avc', 'avc1'])
const COPY_AUDIO_IN_TS = new Set(['aac', 'mp3'])
const TRANSCODE_AUDIO_CODECS = new Set(['ac3', 'eac3', 'dts', 'truehd', 'flac', 'opus', 'vorbis', 'pcm_s16le', 'pcm_s24le'])
const TEXT_SUBTITLE_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text'])
const IMAGE_SUBTITLE_CODECS = new Set(['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'dvdsub'])

function normalizeCodec(codec?: string) {
  return String(codec || '').toLowerCase().split('.')[0]
}

function isH264(codec?: string) {
  const normalized = normalizeCodec(codec)
  return H264_CODECS.has(normalized) || normalized.startsWith('h264')
}

function findStream(mediaInfo: MediaInfoLike | null | undefined, streamIndex: number | null, kind: 'audio' | 'subtitle') {
  if (!mediaInfo) return null
  const tracks = kind === 'audio' ? mediaInfo.audioTracks : mediaInfo.subtitleTracks
  if (streamIndex !== null && streamIndex !== undefined) {
    return tracks.find((track) => track.index === streamIndex) ?? null
  }
  return tracks[0] ?? null
}

export function resolveSubtitleMode(codec?: string): 'none' | 'soft' | 'burn' {
  const normalized = normalizeCodec(codec)
  if (!normalized) return 'none'
  if (TEXT_SUBTITLE_CODECS.has(normalized)) return 'soft'
  if (IMAGE_SUBTITLE_CODECS.has(normalized)) return 'burn'
  return 'burn'
}

export function resolveTranscodePlan(
  mediaInfo: MediaInfoLike | null | undefined,
  audioStreamIndex: number | null = null,
  subtitleStreamIndex: number | null = null,
) {
  const audioTrack = findStream(mediaInfo, audioStreamIndex, 'audio')
  const subtitleTrack = subtitleStreamIndex === null || subtitleStreamIndex === undefined
    ? null
    : findStream(mediaInfo, subtitleStreamIndex, 'subtitle')

  const videoCopy = isH264(mediaInfo?.videoCodec)
  const audioNormalized = normalizeCodec(audioTrack?.codec)
  const audioCopy = COPY_AUDIO_IN_TS.has(audioNormalized)
  const audioTranscode = !audioCopy && (TRANSCODE_AUDIO_CODECS.has(audioNormalized) || Boolean(audioNormalized))
  const subtitleMode = subtitleTrack ? resolveSubtitleMode(subtitleTrack.codec) : 'none'
  const needsVideoTranscode = !videoCopy
  const needsBurnedSubs = subtitleMode === 'burn'

  let mode: TranscodeMode = 'copy'
  if (needsVideoTranscode || needsBurnedSubs) {
    mode = 'transcode'
  } else if (audioTranscode) {
    mode = 'remux'
  }

  return { mode, subtitleMode }
}

export function transcodeStatusLabel(mode: TranscodeMode) {
  if (mode === 'copy') return 'Starting'
  if (mode === 'remux') return 'Remuxing'
  return 'Transcoding'
}

export function playbackPrepareStatus(
  mediaInfo: MediaInfoLike | null | undefined,
  audioStreamIndex: number | null,
  subtitleStreamIndex: number | null,
) {
  if (audioStreamIndex !== null || subtitleStreamIndex !== null) {
    return 'Preparing'
  }
  return transcodeStatusLabel(resolveTranscodePlan(mediaInfo, audioStreamIndex, subtitleStreamIndex).mode)
}
