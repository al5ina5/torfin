import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'

/**
 * Local-only structured error log (JSONL). Writes to <dataDir>/errors.jsonl.
 * Designed for dev review: `npm run errors` or point an agent at the file.
 */

export function createErrorLogger(dataDir) {
  mkdirSync(dataDir, { recursive: true })
  const errorsLogFile = `${dataDir}/errors.jsonl`

  function normalizeError(error) {
    if (error instanceof Error) {
      return {
        message: error.message || String(error),
        stack: error.stack || '',
        name: error.name || 'Error',
      }
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return {
        message: String(error.message || 'Unknown error'),
        stack: String(error.stack || ''),
        name: String(error.name || 'Error'),
      }
    }
    if (typeof error === 'string') {
      return { message: error, stack: '', name: 'Error' }
    }
    try {
      return { message: JSON.stringify(error), stack: '', name: 'Error' }
    } catch {
      return { message: String(error), stack: '', name: 'Error' }
    }
  }

  function fingerprint(message, stack = '') {
    const firstFrame = String(stack).split('\n').find((line) => line.trim().startsWith('at ')) || ''
    return createHash('sha256')
      .update(`${message}\n${firstFrame}`)
      .digest('hex')
      .slice(0, 12)
  }

  function logError(source, error, context = {}) {
    const normalized = normalizeError(error)
    const entry = {
      at: new Date().toISOString(),
      source,
      level: 'error',
      message: normalized.message,
      name: normalized.name,
      stack: normalized.stack,
      fingerprint: fingerprint(normalized.message, normalized.stack),
      ...context,
    }
    try {
      appendFileSync(errorsLogFile, `${JSON.stringify(entry)}\n`)
    } catch {
      // Logging must never break the app.
    }
    if (process.env.NODE_ENV !== 'test') {
      console.error(JSON.stringify(entry))
    }
    return entry
  }

  function installProcessHandlers() {
    process.on('uncaughtException', (error) => {
      logError('server', error, { kind: 'uncaughtException' })
    })
    process.on('unhandledRejection', (reason) => {
      logError('server', reason, { kind: 'unhandledRejection' })
    })
  }

  return { errorsLogFile, logError, installProcessHandlers }
}

export function readRecentErrors(errorsLogFile, { limit = 50 } = {}) {
  if (!existsSync(errorsLogFile)) return []
  const lines = readFileSync(errorsLogFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const parsed = []
  for (const line of lines.slice(-limit)) {
    try {
      parsed.push(JSON.parse(line))
    } catch {
      // Skip corrupt lines.
    }
  }
  return parsed
}

export function summarizeErrors(entries) {
  const groups = new Map()
  for (const entry of entries) {
    const key = entry.fingerprint || entry.message || 'unknown'
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      existing.lastAt = entry.at
      if (entry.source && !existing.sources.includes(entry.source)) {
        existing.sources.push(entry.source)
      }
    } else {
      groups.set(key, {
        fingerprint: key,
        message: entry.message,
        name: entry.name,
        sources: entry.source ? [entry.source] : [],
        count: 1,
        firstAt: entry.at,
        lastAt: entry.at,
        sample: entry,
      })
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || String(b.lastAt).localeCompare(String(a.lastAt)))
}
