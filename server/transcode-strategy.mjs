import { pickHardwareVideoEncoder } from './ffmpeg-bin.mjs'

const H264_CODECS = new Set(['h264', 'avc', 'avc1'])
const COPY_AUDIO_IN_TS = new Set(['aac', 'mp3'])
const TRANSCODE_AUDIO_CODECS = new Set(['ac3', 'eac3', 'dts', 'truehd', 'flac', 'opus', 'vorbis', 'pcm_s16le', 'pcm_s24le'])
const TEXT_SUBTITLE_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text'])
const IMAGE_SUBTITLE_CODECS = new Set(['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'dvdsub'])

function normalizeCodec(codec) {
  return String(codec || '').toLowerCase().split('.')[0]
}

function isH264(codec) {
  const normalized = normalizeCodec(codec)
  return H264_CODECS.has(normalized) || normalized.startsWith('h264')
}

function findStream(mediaInfo, streamIndex, kind) {
  if (!mediaInfo) return null
  const tracks = kind === 'audio' ? mediaInfo.audioTracks : mediaInfo.subtitleTracks
  if (streamIndex !== null && streamIndex !== undefined) {
    return tracks.find((track) => track.index === streamIndex) ?? null
  }
  return tracks[0] ?? null
}

export function resolveSubtitleMode(codec) {
  const normalized = normalizeCodec(codec)
  if (!normalized) return 'none'
  if (TEXT_SUBTITLE_CODECS.has(normalized)) return 'soft'
  if (IMAGE_SUBTITLE_CODECS.has(normalized)) return 'burn'
  return 'burn'
}

/**
 * @param {import('./media-probe.mjs').probeMedia extends (...args: any) => infer R ? R : never} mediaInfo
 * @param {number | null} audioStreamIndex
 * @param {number | null} subtitleStreamIndex
 */
export function resolveTranscodePlan(mediaInfo, audioStreamIndex = null, subtitleStreamIndex = null) {
  const audioTrack = findStream(mediaInfo, audioStreamIndex, 'audio')
  const subtitleTrack = subtitleStreamIndex === null || subtitleStreamIndex === undefined
    ? null
    : findStream(mediaInfo, subtitleStreamIndex, 'subtitle')

  const videoCodec = mediaInfo?.videoCodec
  const audioCodec = audioTrack?.codec
  const videoCopy = isH264(videoCodec)
  const audioNormalized = normalizeCodec(audioCodec)
  const audioCopy = COPY_AUDIO_IN_TS.has(audioNormalized)
  const audioTranscode = !audioCopy && (
    TRANSCODE_AUDIO_CODECS.has(audioNormalized)
    || Boolean(audioNormalized)
  )

  const subtitleMode = subtitleTrack ? resolveSubtitleMode(subtitleTrack.codec) : 'none'
  const needsVideoTranscode = !videoCopy
  const needsAudioTranscode = audioTranscode && !audioCopy
  const needsBurnedSubs = subtitleMode === 'burn'

  let mode = 'copy'
  if (needsVideoTranscode || needsBurnedSubs) {
    mode = 'transcode'
  } else if (needsAudioTranscode) {
    mode = 'remux'
  }

  const videoEncoder = needsVideoTranscode
    ? (pickHardwareVideoEncoder() || 'libx264')
    : null

  return {
    mode,
    videoCopy: videoCopy && !needsBurnedSubs,
    audioCopy: audioCopy && !needsAudioTranscode,
    subtitleMode,
    videoEncoder,
    segmentDuration: mode === 'copy' ? 4 : 2,
  }
}

export function transcodeStatusLabel(mode) {
  if (mode === 'copy') return 'Starting'
  if (mode === 'remux') return 'Remuxing'
  return 'Transcoding'
}
