import { spawn, execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, appendFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** @type {Map<string, { dir: string, process: import('node:child_process').ChildProcessWithoutNullStreams | null, closeProxy?: () => Promise<void> }>} */
const sessions = new Map()

const PROXY_USER_AGENT = 'Torfin/1.0.0-beta'
const TRANSCODE_ATTEMPTS = 3

const FFMPEG_HTTP_ARGS = [
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
  '0',
  '-timeout',
  '30000000',
  '-rw_timeout',
  '30000000',
  '-probesize',
  '10000000',
  '-analyzeduration',
  '10000000',
  '-fflags',
  '+genpts+discardcorrupt',
  '-user_agent',
  PROXY_USER_AGENT,
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

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url)
}

function stopActiveSession() {
  for (const [id, session] of sessions) {
    if (session.process) {
      session.process.kill('SIGTERM')
    }
    void session.closeProxy?.()
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

function isRetriableTranscodeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('FFmpeg exited before the stream was ready')
    || message.includes('did not produce a playable stream in time')
    || message.includes('Error opening input')
    || message.includes('Connection reset')
    || message.includes('HTTP error')
    || message.includes('Upstream returned HTTP')
  )
}

async function fetchUpstream(sourceUrl, requestHeaders = {}) {
  const headers = {
    Accept: '*/*',
    'User-Agent': PROXY_USER_AGENT,
    ...requestHeaders,
  }

  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const upstream = await fetch(sourceUrl, { headers, redirect: 'follow' })
      if (!upstream.ok && upstream.status !== 206) {
        throw new Error(`Upstream returned HTTP ${upstream.status}`)
      }
      return upstream
    } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(attempt * 750)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not reach the stream source.')
}

function createInputProxy(sourceUrl) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const requestHeaders = {}
        if (request.headers.range) requestHeaders.Range = String(request.headers.range)

        const upstream = await fetchUpstream(sourceUrl, requestHeaders)
        const responseHeaders = {
          'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
          'access-control-allow-origin': '*',
          'accept-ranges': upstream.headers.get('accept-ranges') || 'bytes',
        }
        const contentLength = upstream.headers.get('content-length')
        const contentRange = upstream.headers.get('content-range')
        if (contentLength) responseHeaders['content-length'] = contentLength
        if (contentRange) responseHeaders['content-range'] = contentRange

        response.writeHead(upstream.status, responseHeaders)
        if (!upstream.body) {
          response.end()
          return
        }

        await pipeline(Readable.fromWeb(upstream.body), response)
      } catch (error) {
        if (!response.headersSent) {
          response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        }
        response.end(error instanceof Error ? error.message : 'Proxy request failed')
      }
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not start the stream proxy.'))
        return
      }

      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise((closeResolve) => {
          server.close(() => closeResolve())
        }),
      })
    })
  })
}

async function resolveFfmpegInput(sourceUrl) {
  if (!isRemoteUrl(sourceUrl)) {
    return { inputUrl: sourceUrl }
  }

  const proxy = await createInputProxy(sourceUrl)
  return {
    inputUrl: proxy.url,
    closeProxy: proxy.close,
  }
}

function buildFfmpegArgs(sourceUrl, audioStreamIndex, subtitleStreamIndex, segmentPattern, playlist) {
  const inputOptions = isRemoteUrl(sourceUrl) ? [] : FFMPEG_HTTP_ARGS
  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-nostdin',
    ...inputOptions,
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
    '-max_muxing_queue_size',
    '1024',
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
    'vod',
    '-hls_flags',
    'independent_segments',
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

async function waitForPlaylist(playlistPath, segmentPath, child, stderrChunks, timeoutMs = 120000) {
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
    await sleep(250)
  }

  throw new Error(`The transcoder did not produce a playable stream in time.\n${formatFfmpegDetails(stderrChunks)}`)
}

async function startHlsTranscodeOnce(sourceUrl, audioStreamIndex, subtitleStreamIndex) {
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
  const { inputUrl, closeProxy } = await resolveFfmpegInput(sourceUrl)
  const args = buildFfmpegArgs(inputUrl, audioStreamIndex, subtitleStreamIndex, segmentPattern, playlist)
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

  sessions.set(sessionId, { dir: sessionDir, process: child, closeProxy })

  try {
    await waitForPlaylist(playlist, firstSegment, child, stderrChunks)
  } catch (error) {
    stopActiveSession()
    throw error
  }

  return `/api/hls-transcode/${sessionId}/playlist.m3u8`
}

export async function startHlsTranscode(sourceUrl, audioStreamIndex = null, subtitleStreamIndex = null) {
  let lastError = null
  for (let attempt = 1; attempt <= TRANSCODE_ATTEMPTS; attempt += 1) {
    try {
      return await startHlsTranscodeOnce(sourceUrl, audioStreamIndex, subtitleStreamIndex)
    } catch (error) {
      lastError = error
      if (!isRetriableTranscodeError(error) || attempt === TRANSCODE_ATTEMPTS) {
        throw error
      }
      await sleep(attempt * 1000)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not start transcoded playback.')
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
