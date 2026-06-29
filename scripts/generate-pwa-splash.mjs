#!/usr/bin/env node
/**
 * Generate iOS PWA splash screens with the app icon on the theme background.
 * Requires ImageMagick (`convert` on PATH).
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const splashDir = join(publicDir, 'splash')
const iconPath = join(publicDir, 'apple-touch-icon.png')

const THEMES = {
  dark: '#131315',
  light: '#f5f5f7',
}

const SCREENS = [
  {
    width: 1320,
    height: 2868,
    media:
      '(prefers-color-scheme: VAR) and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    width: 1206,
    height: 2622,
    media:
      '(prefers-color-scheme: VAR) and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    width: 1170,
    height: 2532,
    media:
      '(prefers-color-scheme: VAR) and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    width: 1080,
    height: 2340,
    media:
      '(prefers-color-scheme: VAR) and (device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    width: 1242,
    height: 2688,
    media:
      '(prefers-color-scheme: VAR) and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    width: 828,
    height: 1792,
    media:
      '(prefers-color-scheme: VAR) and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    width: 2048,
    height: 2732,
    media:
      '(prefers-color-scheme: VAR) and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
]

function runConvert(args) {
  const result = spawnSync('convert', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    process.exit(result.status ?? 1)
  }
}

if (!existsSync(iconPath)) {
  console.error(`Missing ${iconPath}`)
  process.exit(1)
}

mkdirSync(splashDir, { recursive: true })

for (const [theme, color] of Object.entries(THEMES)) {
  for (const { width, height } of SCREENS) {
    const iconSize = Math.round(Math.min(width, height) * 0.22)
    const output = join(splashDir, `${theme}-${width}x${height}.png`)
    runConvert([
      '-size',
      `${width}x${height}`,
      `xc:${color}`,
      '(',
      iconPath,
      '-resize',
      `${iconSize}x${iconSize}`,
      ')',
      '-gravity',
      'center',
      '-composite',
      output,
    ])
  }
}

console.log(`Generated ${Object.keys(THEMES).length * SCREENS.length} splash images in public/splash/`)
