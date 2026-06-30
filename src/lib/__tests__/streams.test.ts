import { describe, expect, it } from 'vitest'

import type { StreamResult } from '../../types'
import { filterStreamsForProfile, normalizeStreams, playabilityScore, sortStreamsByPlayability } from '../streams'

describe('playabilityScore', () => {
  const base: StreamResult = {
    pluginName: 'Torrentio',
    title: 'Movie 1080p',
    tags: [],
    rank: 50,
  }

  it('ranks cached streams highest', () => {
    const cached = { ...base, title: 'Movie 1080p cached instant', description: 'torbox' }
    const uncached = { ...base, description: 'seeders 500' }
    expect(playabilityScore(cached, 'key')).toBeGreaterThan(playabilityScore(uncached, 'key'))
  })

  it('penalizes torrent streams without debrid key', () => {
    const torrent = { ...base, infoHash: 'abc' }
    expect(playabilityScore(torrent, '')).toBeLessThan(playabilityScore(torrent, 'key'))
  })
})

describe('sortStreamsByPlayability', () => {
  it('orders cached before uncached', () => {
    const cached: StreamResult = {
      pluginName: 'p',
      title: 'Cached 720p',
      description: 'cached torbox instant',
      tags: ['Torbox'],
      rank: 65,
    }
    const uncached: StreamResult = {
      pluginName: 'p',
      title: 'Uncached 1080p',
      description: 'seeders 200',
      tags: ['1080p'],
      rank: 100,
    }
    const sorted = sortStreamsByPlayability([uncached, cached], 'key')
    expect(sorted[0]?.title).toContain('Cached')
  })
})

describe('filterStreamsForProfile', () => {
  const raw = {
    streams: [
      { title: 'Movie 2160p cached', description: 'seeders 120 size 25 GB' },
      { title: 'Movie 1080p cached', description: 'seeders 100 size 10 GB' },
      { title: 'Movie 720p', description: 'seeders 80 size 3 GB' },
      { title: 'Movie CAM', description: 'camrip seeders 500 size 1 GB' },
      { title: 'Movie 1080p 3D', description: 'half-sbs seeders 50 size 7 GB' },
    ],
  }

  it('excludes cam and 3d leftovers from addon output', () => {
    const normalized = normalizeStreams('plugin', raw)
    const filtered = filterStreamsForProfile(normalized, 'netflix', false, undefined, 'key')
    const titles = filtered.map((item) => item.title.toLowerCase())

    expect(titles).toContain('movie 2160p cached')
    expect(titles).toContain('movie 1080p cached')
    expect(titles).toContain('movie 720p')
    expect(titles.join(' ')).not.toContain('cam')
    expect(titles.join(' ')).not.toContain('3d')
  })

  it('preferCachedResults limits to cached entries when available', () => {
    const normalized = normalizeStreams('plugin', raw)
    const filtered = filterStreamsForProfile(normalized, 'cinephile', true, undefined, 'key')

    expect(filtered.every((item) => /cached|torbox|instant/i.test(`${item.title} ${item.description ?? ''}`))).toBe(true)
  })
})
