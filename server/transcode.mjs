import { spawn, execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

/** @type {Map<string, { dir: string, process: import('node:child_process').ChildProcessWithoutNullStreams | null }>} */
const sessions = new Map()

const FFMPEG_HTTP_ARGS = [
  '-reconnect',
  '1',
  '-reconnect_streamed',
  '1',
  '-reconnect_delay_max',
  '5',
  '-probesize',
  '10000000',
  '-analyzeduration',
  '10000000',
  '-fflags',
  '+genpts',
  '-user_agent',
  'Torfin/1.0.0-beta',
]

function findFfmpeg() {
  for (const cmd of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg']) {
    try {
      execFileSync(cmd, ['-version'], { stdio: 'ignore' })
      return cmd
    } catch {
      // try next candidate
    }
  }
  return null
}

function stopActiveSession() {
  for (const [id, session] of sessions) {
    if (session.process) {
      session.process.kill('SIGTERM')
    }
    try {
      rmSync(session.dir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
    sessions.delete(id)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatFfmpegDetails(stderrChunks) {
  const details = stderrChunks
    .join('')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join('\n')
  return details || 'No ffmpeg output was captured.'
}

function buildFfmpegArgs(sourceUrl, audioStreamIndex, subtitleStreamIndex, segmentPattern, playlist) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-nostdin',
    ...FFMPEG_HTTP_ARGS,
    '-i',
    sourceUrl,
    '-map',
    '0:v:0',
    '-map',
    audioStreamIndex === null || audioStreamIndex === undefined ? '0:a:0?' : `0:${audioStreamIndex}`,
  ]

  if (subtitleStreamIndex === null || subtitleStreamIndex === undefined) {
    args.push('-sn')
  } else {
    args.push('-map', `0:${subtitleStreamIndex}`)
  }

  args.push(
    '-dn',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ac',
    '2',
  )

  if (subtitleStreamIndex !== null && subtitleStreamIndex !== undefined) {
    args.push('-c:s', 'webvtt')
  }

  args.push(
    '-f',
    'hls',
    '-hls_time',
    '2',
    '-hls_init_time',
    '1',
    '-hls_list_size',
    '0',
    '-hls_playlist_type',
    'event',
    '-hls_flags',
    'independent_segments+program_date_time',
    '-hls_segment_filename',
    segmentPattern,
    playlist,
  )

  return args
}

function isPlaylistReady(playlistPath, segmentPath) {
  if (existsSync(playlistPath)) {
    const contents = readFileSync(playlistPath, 'utf8')
    if (contents.includes('#EXTINF')) return true
  }
  return existsSync(segmentPath)
}

async function waitForPlaylist(playlistPath, segmentPath, child, stderrChunks, timeoutMs = 90000) {
  let exitCode = null
  child.on('close', (code) => {
    exitCode = code
  })

  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (exitCode !== null) {
      if (isPlaylistReady(playlistPath, segmentPath)) return
      throw new Error(`FFmpeg exited before the stream was ready.\n${formatFfmpegDetails(stderrChunks)}`)
    }
    if (isPlaylistReady(playlistPath, segmentPath)) return
    await sleep(500)
  }

  throw new Error(`The transcoder did not produce a playable stream in time.\n${formatFfmpegDetails(stderrChunks)}`)
}

export async function startHlsTranscode(sourceUrl, audioStreamIndex = null, subtitleStreamIndex = null) {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) {
    throw new Error('FFmpeg is not available. Rebuild the Docker image or install ffmpeg on this host.')
  }

  stopActiveSession()

  const sessionId = randomUUID()
  const sessionDir = join(tmpdir(), `torfin-hls-${sessionId}`)
  mkdirSync(sessionDir, { recursive: true })

  const playlist = join(sessionDir, 'playlist.m3u8')
  const firstSegment = join(sessionDir, 'segment_00000.ts')
  const segmentPattern = join(sessionDir, 'segment_%05d.ts')
  const stderrLog = join(sessionDir, 'ffmpeg.log')
  const args = buildFfmpegArgs(sourceUrl, audioStreamIndex, subtitleStreamIndex, segmentPattern, playlist)
  const stderrChunks = []

  const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    stderrChunks.push(text)
    try {
      appendFileSync(stderrLog, text)
    } catch {
      // ignore log write errors
    }
  })

  sessions.set(sessionId, { dir: sessionDir, process: child })

  try {
    await waitForPlaylist(playlist, firstSegment, child, stderrChunks)
  } catch (error) {
    stopActiveSession()
    throw error
  }

  return `/api/hls-transcode/${sessionId}/playlist.m3u8`
}

export function serveHlsTranscodeFile(pathname, response) {
  const match = pathname.match(/^\/api\/hls-transcode\/([^/]+)\/(.+)$/)
  if (!match) return false

  const [, sessionId, rawFile] = match
  const file = decodeURIComponent(rawFile)
  if (!file || file.includes('..')) {
    response.writeHead(403)
    response.end()
    return true
  }

  const session = sessions.get(sessionId)
  if (!session) {
    response.writeHead(404)
    response.end()
    return true
  }

  const filePath = join(session.dir, file)
  if (!existsSync(filePath)) {
    response.writeHead(404)
    response.end()
    return true
  }

  const contentType = file.endsWith('.m3u8')
    ? 'application/vnd.apple.mpegurl'
    : file.endsWith('.ts')
      ? 'video/mp2t'
      : 'application/octet-stream'

  response.writeHead(200, {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  })
  createReadStream(filePath).pipe(response)
  return true
}
