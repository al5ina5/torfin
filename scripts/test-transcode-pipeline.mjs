#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { findFfmpeg } from '../server/ffmpeg-bin.mjs'
import { resolveTranscodePlan } from '../server/transcode-strategy.mjs'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

function runFfmpeg(args) {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) throw new Error('ffmpeg not found')
  execFileSync(ffmpeg, args, { stdio: 'pipe' })
}

async function waitForFile(path, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (existsSync(path)) return true
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return false
}

async function main() {
  console.log('transcode pipeline test')

  const h264Plan = resolveTranscodePlan({
    videoCodec: 'h264',
    audioTracks: [{ index: 1, codec: 'aac' }],
    subtitleTracks: [],
  })
  assert(h264Plan.mode === 'copy', 'expected copy plan for h264/aac')

  const remuxPlan = resolveTranscodePlan({
    videoCodec: 'h264',
    audioTracks: [{ index: 1, codec: 'ac3' }],
    subtitleTracks: [],
  })
  assert(remuxPlan.mode === 'remux', 'expected remux plan for ac3 audio')

  const ffmpeg = findFfmpeg()
  if (!ffmpeg) {
    console.log('SKIP ffmpeg integration (ffmpeg not installed)')
    process.exit(0)
  }

  const workDir = join(tmpdir(), `torfin-transcode-test-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })
  const source = join(workDir, 'sample.mkv')

  try {
    runFfmpeg([
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x180:rate=24',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast',
      '-c:a', 'aac', '-shortest', source,
    ])

    const outDir = join(workDir, 'hls')
    mkdirSync(outDir)
    const playlist = join(outDir, 'playlist.m3u8')
    const segmentPattern = join(outDir, 'segment_%05d.ts')

    const child = spawn(ffmpeg, [
      '-hide_banner', '-loglevel', 'warning', '-nostdin',
      '-i', source,
      '-map', '0:v:0', '-map', '0:a:0',
      '-dn', '-c:v', 'copy', '-c:a', 'copy',
      '-f', 'hls', '-hls_time', '1', '-hls_list_size', '0',
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', segmentPattern,
      playlist,
    ], { stdio: ['ignore', 'ignore', 'pipe'] })

    const ready = await waitForFile(join(outDir, 'segment_00000.ts'))
    child.kill('SIGTERM')
    assert(ready, 'ffmpeg copy-mode hls should produce first segment')
    assert(existsSync(playlist), 'playlist should exist')

    console.log('PASS transcode pipeline test')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
