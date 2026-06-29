import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

import {
  FFMPEG_HTTP_ARGS,
  findFfmpeg,
  isRemoteUrl,
} from './ffmpeg-bin.mjs'
import { probeDuration, probeMedia } from './media-probe.mjs'
import { resolveTranscodePlan, transcodeStatusLabel } from './transcode-strategy.mjs'

/** @type {Map<string, {
 *   dir: string,
 *   process: import('node:child_process').ChildProcessWithoutNullStreams | null,
 *   duration: number | null,
 *   sourceUrl: string,
 *   audioStreamIndex: number | null,
 *   subtitleStreamIndex: number | null,
 *   mediaOffset: number,
 *   mode: string,
 * }>} */
const sessions = new Map()

const TRANSCODE_ATTEMPTS = 3
const HLS_SEGMENT_DURATION_SECS = 2

export { probeMedia } from './media-probe.mjs'
export { resolveTranscodePlan, transcodeStatusLabel } from './transcode-strategy.mjs'

export function isFfmpegAvailable() {
  return findFfmpeg() !== null
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

function appendVideoEncodeArgs(args, plan) {
  if (plan.videoCopy) {
    args.push('-c:v', 'copy')
    return
  }

  const encoder = plan.videoEncoder || 'libx264'
  args.push('-c:v', encoder)

  if (encoder === 'libx264') {
    args.push(
      '-preset', 'veryfast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-g', '48',
      '-keyint_min', '48',
    )
  } else if (encoder === 'h264_videotoolbox') {
    args.push('-q:v', '65', '-pix_fmt', 'yuv420p', '-g', '48')
  } else if (encoder === 'h264_nvenc') {
    args.push('-preset', 'p4', '-cq', '23', '-pix_fmt', 'yuv420p', '-g', '48')
  } else if (encoder === 'h264_vaapi') {
    args.push('-qp', '23', '-pix_fmt', 'yuv420p', '-g', '48')
  } else if (encoder === 'h264_qsv') {
    args.push('-global_quality', '23', '-pix_fmt', 'yuv420p', '-g', '48')
  } else {
    args.push('-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p')
  }
}

function appendAudioEncodeArgs(args, plan) {
  if (plan.audioCopy) {
    args.push('-c:a', 'copy')
    return
  }

  args.push(
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
  )
}

function subtitleOrdinal(mediaInfo, subtitleStreamIndex) {
  const tracks = mediaInfo?.subtitleTracks || []
  const position = tracks.findIndex((track) => track.index === subtitleStreamIndex)
  return position >= 0 ? position : 0
}

function appendSubtitleArgs(args, plan, subtitleStreamIndex, sourceUrl, mediaInfo) {
  if (plan.subtitleMode === 'none' || subtitleStreamIndex === null || subtitleStreamIndex === undefined) {
    args.push('-sn')
    return
  }

  if (plan.subtitleMode === 'soft') {
    args.push('-c:s', 'webvtt')
    return
  }

  const escapedSource = sourceUrl.replace(/'/g, "'\\''")
  const ordinal = subtitleOrdinal(mediaInfo, subtitleStreamIndex)
  args.push(
    '-vf', `subtitles=filename='${escapedSource}':si=${ordinal}`,
    '-sn',
  )
}

function buildFfmpegArgs(sourceUrl, audioStreamIndex, subtitleStreamIndex, plan, segmentPattern, playlist, mediaInfo, startSeconds = 0) {
  const inputOptions = isRemoteUrl(sourceUrl) ? FFMPEG_HTTP_ARGS : []
  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-nostdin',
    ...inputOptions,
  ]

  if (startSeconds > 0) {
    args.push('-ss', String(startSeconds))
  }

  args.push('-i', sourceUrl)
  args.push('-map', '0:v:0')
  args.push(
    '-map',
    audioStreamIndex === null || audioStreamIndex === undefined ? '0:a:0' : `0:${audioStreamIndex}`,
  )

  if (subtitleStreamIndex !== null && subtitleStreamIndex !== undefined && plan.subtitleMode === 'soft') {
    args.push('-map', `0:${subtitleStreamIndex}`)
  }

  args.push('-dn', '-max_muxing_queue_size', '2048')
  appendVideoEncodeArgs(args, plan)
  appendAudioEncodeArgs(args, plan)
  appendSubtitleArgs(args, plan, subtitleStreamIndex, sourceUrl, mediaInfo)

  const segmentDuration = plan.segmentDuration || HLS_SEGMENT_DURATION_SECS
  const hlsFlags = ['independent_segments']
  if (plan.mode !== 'copy') {
    hlsFlags.push('append_list')
  }

  args.push(
    '-f', 'hls',
    '-hls_time', String(segmentDuration),
    '-hls_init_time', plan.mode === 'copy' ? '2' : '1',
    '-hls_list_size', '0',
    '-hls_playlist_type', 'vod',
    '-hls_flags', hlsFlags.join('+'),
    '-hls_segment_filename', segmentPattern,
    playlist,
  )

  return args
}

function countPlaylistSegments(playlistPath) {
  if (!existsSync(playlistPath)) return 0
  const contents = readFileSync(playlistPath, 'utf8')
  return (contents.match(/#EXTINF/g) || []).length
}

function isPlaylistReady(playlistPath, segmentPath) {
  if (!existsSync(segmentPath)) return false
  return countPlaylistSegments(playlistPath) >= 1
}

async function waitForFile(filePath, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (existsSync(filePath)) return true
    await sleep(200)
  }
  return false
}

async function waitForPlaylist(playlistPath, segmentPath, child, stderrChunks, timeoutMs = 180000) {
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
    await sleep(200)
  }

  throw new Error(`The transcoder did not produce a playable stream in time.\n${formatFfmpegDetails(stderrChunks)}`)
}

function clearSessionOutput(sessionDir) {
  try {
    for (const name of readdirSync(sessionDir)) {
      if (name.startsWith('segment_') || name === 'playlist.m3u8' || name === 'ffmpeg.log' || name.endsWith('.vtt')) {
        rmSync(join(sessionDir, name), { force: true })
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

async function stopSessionProcess(session) {
  if (!session.process) return
  const child = session.process
  session.process = null

  if (child.exitCode !== null) return

  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore kill errors
      }
      resolve()
    }, 1500)
    child.once('close', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
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

async function probeForSession(sourceUrl) {
  try {
    return probeMedia(sourceUrl)
  } catch {
    return {
      duration: probeDuration(sourceUrl) ?? undefined,
      audioTracks: [],
      subtitleTracks: [],
      audioCodecs: [],
    }
  }
}

async function launchSessionTranscode(session, startSeconds = 0) {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) {
    throw new Error('FFmpeg is not available. Rebuild the Docker image or install ffmpeg on this host.')
  }

  await stopSessionProcess(session)
  clearSessionOutput(session.dir)
  session.mediaOffset = startSeconds

  if (!session.mediaInfo) {
    session.mediaInfo = await probeForSession(session.sourceUrl)
    session.duration = session.mediaInfo.duration ?? session.duration
  }

  const plan = resolveTranscodePlan(
    session.mediaInfo,
    session.audioStreamIndex,
    session.subtitleStreamIndex,
  )
  session.mode = plan.mode

  const playlist = join(session.dir, 'playlist.m3u8')
  const firstSegment = join(session.dir, 'segment_00000.ts')
  const segmentPattern = join(session.dir, 'segment_%05d.ts')
  const stderrLog = join(session.dir, 'ffmpeg.log')
  const args = buildFfmpegArgs(
    session.sourceUrl,
    session.audioStreamIndex,
    session.subtitleStreamIndex,
    plan,
    segmentPattern,
    playlist,
    session.mediaInfo,
    startSeconds,
  )
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

  session.process = child

  try {
    const readyTimeout = plan.mode === 'copy' ? 90000 : 180000
    await waitForPlaylist(playlist, firstSegment, child, stderrChunks, readyTimeout)
  } catch (error) {
    if (session.process === child) {
      child.kill('SIGTERM')
      session.process = null
    }

    if (plan.videoCopy && plan.mode !== 'transcode') {
      session.mode = 'transcode'
      const fallbackPlan = {
        ...plan,
        mode: 'transcode',
        videoCopy: false,
        audioCopy: false,
        videoEncoder: plan.videoEncoder || 'libx264',
        segmentDuration: 2,
      }
      const fallbackArgs = buildFfmpegArgs(
        session.sourceUrl,
        session.audioStreamIndex,
        session.subtitleStreamIndex,
        fallbackPlan,
        segmentPattern,
        playlist,
        session.mediaInfo,
        startSeconds,
      )
      const fallbackChild = spawn(ffmpeg, fallbackArgs, { stdio: ['ignore', 'ignore', 'pipe'] })
      const fallbackChunks = []
      fallbackChild.stderr.on('data', (chunk) => {
        const text = chunk.toString()
        fallbackChunks.push(text)
        try {
          appendFileSync(stderrLog, text)
        } catch {
          // ignore
        }
      })
      session.process = fallbackChild
      await waitForPlaylist(playlist, firstSegment, fallbackChild, fallbackChunks, 180000)
      return
    }

    throw error
  }
}

async function startHlsTranscodeOnce(sourceUrl, audioStreamIndex, subtitleStreamIndex, startSeconds = 0) {
  stopActiveSession()

  const sessionId = randomUUID()
  const sessionDir = join(tmpdir(), `torfin-hls-${sessionId}`)
  mkdirSync(sessionDir, { recursive: true })

  const mediaInfo = await probeForSession(sourceUrl)
  const plan = resolveTranscodePlan(mediaInfo, audioStreamIndex, subtitleStreamIndex)

  const session = {
    dir: sessionDir,
    process: null,
    duration: mediaInfo.duration ?? null,
    sourceUrl,
    audioStreamIndex,
    subtitleStreamIndex,
    mediaOffset: startSeconds,
    mode: plan.mode,
    mediaInfo,
  }

  sessions.set(sessionId, session)
  await launchSessionTranscode(session, startSeconds)

  return {
    url: `/api/hls-transcode/${sessionId}/playlist.m3u8`,
    duration: session.duration,
    mediaOffset: startSeconds,
    mode: session.mode,
    statusLabel: transcodeStatusLabel(session.mode),
  }
}

export async function seekHlsTranscode(sessionId, seekSeconds) {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error('Transcode session not found.')
  }

  const target = Math.max(0, Number(seekSeconds) || 0)
  const maxDuration = session.duration
  const clamped = maxDuration && maxDuration > 0 ? Math.min(target, Math.max(maxDuration - 0.25, 0)) : target

  await launchSessionTranscode(session, clamped)

  return {
    url: `/api/hls-transcode/${sessionId}/playlist.m3u8`,
    duration: session.duration,
    mediaOffset: clamped,
    mode: session.mode,
    statusLabel: transcodeStatusLabel(session.mode),
  }
}

function countHlsSegments(sessionDir) {
  try {
    return readdirSync(sessionDir).filter((name) => name.startsWith('segment_') && name.endsWith('.ts')).length
  } catch {
    return 0
  }
}

function getActiveTranscodeSession() {
  for (const session of sessions.values()) {
    if (session.process) return session
  }
  return null
}

export function getHlsTranscodeProgress() {
  const session = getActiveTranscodeSession()
  if (!session) {
    return {
      active: false,
      segmentCount: 0,
      playlistReady: false,
      transcodedSeconds: 0,
      processRunning: false,
      duration: null,
      mode: null,
    }
  }

  const playlist = join(session.dir, 'playlist.m3u8')
  const firstSegment = join(session.dir, 'segment_00000.ts')
  const segmentCount = countHlsSegments(session.dir)
  const processRunning = session.process ? session.process.exitCode === null : false
  const segmentDuration = session.mode === 'copy' ? 4 : HLS_SEGMENT_DURATION_SECS

  return {
    active: true,
    segmentCount,
    playlistReady: isPlaylistReady(playlist, firstSegment),
    transcodedSeconds: segmentCount * segmentDuration,
    processRunning,
    duration: session.duration ?? null,
    mode: session.mode ?? null,
  }
}

export async function startHlsTranscode(
  sourceUrl,
  audioStreamIndex = null,
  subtitleStreamIndex = null,
  startSeconds = 0,
) {
  let lastError = null
  for (let attempt = 1; attempt <= TRANSCODE_ATTEMPTS; attempt += 1) {
    try {
      return await startHlsTranscodeOnce(sourceUrl, audioStreamIndex, subtitleStreamIndex, startSeconds)
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

export async function serveHlsTranscodeFile(pathname, response) {
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
  if (!existsSync(filePath) && (file.endsWith('.ts') || file.endsWith('.vtt') || file.endsWith('.m3u8'))) {
    const ready = await waitForFile(filePath, 30000)
    if (!ready) {
      response.writeHead(404)
      response.end()
      return true
    }
  }

  if (!existsSync(filePath)) {
    response.writeHead(404)
    response.end()
    return true
  }

  const contentType = file.endsWith('.m3u8')
    ? 'application/vnd.apple.mpegurl'
    : file.endsWith('.ts')
      ? 'video/mp2t'
      : file.endsWith('.vtt')
        ? 'text/vtt'
        : 'application/octet-stream'

  const headers = {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  }
  if (session.duration && session.duration > 0) {
    headers['x-torfin-duration'] = String(session.duration)
  }
  if (session.mediaOffset > 0) {
    headers['x-torfin-media-offset'] = String(session.mediaOffset)
  }
  if (session.mode) {
    headers['x-torfin-transcode-mode'] = session.mode
  }

  response.writeHead(200, headers)
  createReadStream(filePath).pipe(response)
  return true
}
