import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createErrorLogger, readRecentErrors, summarizeErrors } from '../error-log.mjs'

describe('error-log', () => {
  it('writes JSONL entries with fingerprints', () => {
    const dir = mkdtempSync(join(tmpdir(), 'torfin-errors-'))
    try {
      const { errorsLogFile, logError } = createErrorLogger(dir)
      logError('server', new Error('boom'), { path: '/api/test' })
      const lines = readFileSync(errorsLogFile, 'utf8').trim().split('\n')
      expect(lines).toHaveLength(1)
      const entry = JSON.parse(lines[0])
      expect(entry.message).toBe('boom')
      expect(entry.source).toBe('server')
      expect(entry.fingerprint).toMatch(/^[a-f0-9]{12}$/)
      expect(entry.path).toBe('/api/test')

      const recent = readRecentErrors(errorsLogFile)
      expect(recent).toHaveLength(1)
      const summary = summarizeErrors(recent)
      expect(summary[0].count).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('groups duplicate fingerprints in summaries', () => {
    const entries = [
      { at: '2026-01-01T00:00:00.000Z', fingerprint: 'abc', message: 'x', name: 'Error', source: 'client' },
      { at: '2026-01-01T00:00:01.000Z', fingerprint: 'abc', message: 'x', name: 'Error', source: 'client' },
      { at: '2026-01-01T00:00:02.000Z', fingerprint: 'def', message: 'y', name: 'Error', source: 'server' },
    ]
    const summary = summarizeErrors(entries)
    expect(summary).toHaveLength(2)
    expect(summary[0].count).toBe(2)
  })
})
