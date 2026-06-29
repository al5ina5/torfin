import { execFileSync } from 'node:child_process'

export const PROXY_USER_AGENT = 'Torfin/1.0.0-beta'

export function findBinary(candidates) {
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['-version'], { stdio: 'ignore' })
      return cmd
    } catch {
      // try next candidate
    }
  }
  return null
}

export function findFfmpeg() {
  return findBinary(['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg'])
}

export function findFfprobe() {
  return findBinary(['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe', 'ffprobe'])
}

export function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url)
}

export const FFMPEG_HTTP_ARGS = [
  '-reconnect',
  '1',
  '-reconnect_streamed',
  '1',
  '-reconnect_on_network_error',
  '1',
  '-reconnect_on_http_error',
  '403,404,429,500,502,503,504',
  '-reconnect_delay_max',
  '10',
  '-multiple_requests',
  '1',
  '-seekable',
  '1',
  '-timeout',
  '30000000',
  '-rw_timeout',
  '30000000',
  '-probesize',
  '50000000',
  '-analyzeduration',
  '10000000',
  '-fflags',
  '+genpts+discardcorrupt',
  '-user_agent',
  PROXY_USER_AGENT,
]

let cachedEncoders = null

export function listFfmpegEncoders() {
  if (cachedEncoders) return cachedEncoders
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) {
    cachedEncoders = ''
    return cachedEncoders
  }
  try {
    cachedEncoders = execFileSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 10000 })
  } catch {
    cachedEncoders = ''
  }
  return cachedEncoders
}

export function pickHardwareVideoEncoder() {
  const encoders = listFfmpegEncoders()
  if (process.platform === 'darwin' && encoders.includes('h264_videotoolbox')) {
    return 'h264_videotoolbox'
  }
  if (encoders.includes('h264_nvenc')) return 'h264_nvenc'
  if (encoders.includes('h264_vaapi')) return 'h264_vaapi'
  if (encoders.includes('h264_qsv')) return 'h264_qsv'
  return null
}
