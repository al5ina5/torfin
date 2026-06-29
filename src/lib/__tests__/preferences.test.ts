import { describe, expect, it } from 'vitest'

import { defaultPreferences, normalizePreferences } from '../preferences'

describe('normalizePreferences', () => {
  it('fills defaults for missing fields', () => {
    const normalized = normalizePreferences({ posterSize: 140 })
    expect(normalized.posterSize).toBe(140)
    expect(normalized.defaultStartupCatalog).toBe('lastUsed')
    expect(normalized.compactResultsLimit).toBe(4)
    expect(normalized.jellyfinDuplicateAction).toBe('ask')
  })

  it('clamps compact results and resume settings', () => {
    const normalized = normalizePreferences({
      compactResultsLimit: 99,
      resumeMinSeconds: 500,
      completeRatioPercent: 50,
    })
    expect(normalized.compactResultsLimit).toBe(10)
    expect(normalized.resumeMinSeconds).toBe(120)
    expect(normalized.completeRatioPercent).toBe(85)
  })

  it('rejects invalid enum values', () => {
    const normalized = normalizePreferences({
      nextEpisodeCountdown: 7 as never,
      apiRequestTimeoutSeconds: 20 as never,
      defaultStartupCatalog: 'invalid' as never,
    })
    expect(normalized.nextEpisodeCountdown).toBe(defaultPreferences.nextEpisodeCountdown)
    expect(normalized.apiRequestTimeoutSeconds).toBe(defaultPreferences.apiRequestTimeoutSeconds)
    expect(normalized.defaultStartupCatalog).toBe('lastUsed')
  })
})
