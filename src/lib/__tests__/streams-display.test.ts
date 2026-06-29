import { describe, expect, it } from 'vitest'

import { compactStreamTitle, streamMetaSummary } from '../streams-display'
import type { StreamResult } from '../../types'

function makeStream(overrides: Partial<StreamResult> = {}): StreamResult {
  return {
    pluginName: 'torrentio',
    title: 'Film 1080p',
    tags: ['1080p', 'Torbox'],
    rank: 1,
    ...overrides,
  }
}

describe('compactStreamTitle', () => {
  it('humanizes dot-separated release names with season info', () => {
    const stream = makeStream({
      title: 'Sugar.S01.COMPLETE.2160p.WEB-DL.DV.P5.DD+Atmos',
    })

    expect(compactStreamTitle(stream)).toBe('Sugar · S01')
  })

  it('keeps simple titles readable', () => {
    const stream = makeStream({ title: 'Film 1080p' })
    expect(compactStreamTitle(stream)).toBe('Film')
  })
})

describe('streamMetaSummary', () => {
  it('joins quality, size, and peers into one line', () => {
    const stream = makeStream({
      title: 'Film 2160p',
      description: 'seeders 8 size 8.9 GB',
      tags: ['4K', 'Atmos', 'Torbox'],
    })

    expect(streamMetaSummary(stream)).toBe('4K Atmos · 8.9 GB · 8 peers')
  })
})
