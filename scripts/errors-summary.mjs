#!/usr/bin/env node
/**
 * Summarize local error log for review (human or agent).
 *
 * Usage:
 *   npm run errors
 *   npm run errors -- --tail 20
 *   TORBOX_DATA_DIR=/path npm run errors
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createErrorLogger, readRecentErrors, summarizeErrors } from '../server/error-log.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

function defaultDataDir() {
  if (process.env.TORBOX_DATA_DIR) return process.env.TORBOX_DATA_DIR
  return join(repoRoot, 'data')
}

function parseArgs(argv) {
  const options = { tail: 50, raw: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tail' && argv[i + 1]) {
      options.tail = Number(argv[++i]) || 50
    } else if (argv[i] === '--raw') {
      options.raw = true
    }
  }
  return options
}

const dataDir = defaultDataDir()
const { errorsLogFile } = createErrorLogger(dataDir)
const { tail, raw } = parseArgs(process.argv.slice(2))

if (!existsSync(errorsLogFile)) {
  console.log(`No errors logged yet.\nFile: ${errorsLogFile}`)
  process.exit(0)
}

const recent = readRecentErrors(errorsLogFile, { limit: tail })

if (raw) {
  for (const entry of recent) {
    console.log(JSON.stringify(entry))
  }
  process.exit(0)
}

const summary = summarizeErrors(recent)

console.log(`Error log: ${errorsLogFile}`)
console.log(`Showing last ${recent.length} entries (${summary.length} unique fingerprints)\n`)

if (summary.length === 0) {
  console.log('No parseable errors in range.')
  process.exit(0)
}

for (const group of summary) {
  const sources = group.sources.length ? group.sources.join(', ') : 'unknown'
  console.log(`[${group.count}x] ${group.name}: ${group.message}`)
  console.log(`  fingerprint: ${group.fingerprint} | sources: ${sources}`)
  console.log(`  first: ${group.firstAt} | last: ${group.lastAt}`)
  if (group.sample?.stack) {
    const stackLine = String(group.sample.stack).split('\n').find((line) => line.trim().startsWith('at '))
    if (stackLine) console.log(`  ${stackLine.trim()}`)
  }
  console.log('')
}

console.log('Tip: share this file or run `npm run errors -- --raw` for full JSONL entries.')
