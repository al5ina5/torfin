import { describe, expect, it } from 'vitest'

import { filterStreamsForProfile, normalizeStreams, qualityRank } from '../streams'

describe('qualityRank', () => {
  it('scores premium stream keywords higher', () => {
    const premium = qualityRank('Movie 2160p 4K cached remux bluray seeders 200')
    const basic = qualityRank('Movie 720p web-dl seeders 2')
    expect(premium).toBeGreaterThan(basic)
  })
})

describe('normalizeStreams', () => {
  it('normalizes raw payload stream records', () => {
    const results = normalizeStreams('comet', {
      streams: [
        {
          title: 'Film 1080p',
          description: 'cached remux',
          url: 'https://example.test/stream',
          fileIdx: 1,
        },
      ],
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      pluginName: 'comet',
      title: 'Film 1080p',
      description: 'cached remux',
      url: 'https://example.test/stream',
      fileIdx: 1,
    })
    expect(results[0]?.tags).toEqual(expect.arrayContaining(['1080p', 'Torbox', 'Remux']))
    expect(results[0]?.rank).toBeGreaterThan(0)
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

  it('netflix profile keeps best stream per quality and excludes cam/3d', () => {
    const normalized = normalizeStreams('plugin', raw)
    const filtered = filterStreamsForProfile(normalized, 'netflix', false)
    const titles = filtered.map((item) => item.title.toLowerCase())

    expect(titles).toContain('movie 2160p cached')
    expect(titles).toContain('movie 1080p cached')
    expect(titles).toContain('movie 720p')
    expect(titles.join(' ')).not.toContain('cam')
    expect(titles.join(' ')).not.toContain('3d')
  })

  it('dataSaver profile excludes very large results', () => {
    const normalized = normalizeStreams('plugin', raw)
    const filtered = filterStreamsForProfile(normalized, 'dataSaver', false)
    const titles = filtered.map((item) => item.title.toLowerCase())

    expect(titles).not.toContain('movie 2160p cached')
    expect(titles).toContain('movie 1080p cached')
    expect(titles).toContain('movie 720p')
  })

  it('preferCachedResults limits to cached entries when available', () => {
    const normalized = normalizeStreams('plugin', raw)
    const filtered = filterStreamsForProfile(normalized, 'cinephile', true)

    expect(filtered.every((item) => /cached|torbox|instant/i.test(`${item.title} ${item.description ?? ''}`))).toBe(true)
  })
})
