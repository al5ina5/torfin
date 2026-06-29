import { describe, expect, it } from 'vitest'

import { catalogPageUrl, normalizeMovie, normalizeSeriesEpisodes } from '../cinemeta'

describe('catalogPageUrl', () => {
  it('keeps base url when skip is zero or negative', () => {
    const base = 'https://v3-cinemeta.strem.io/catalog/movie/top.json'
    expect(catalogPageUrl(base, 0)).toBe(base)
    expect(catalogPageUrl(base, -1)).toBe(base)
  })

  it('adds skip segment for paginated requests', () => {
    expect(catalogPageUrl('https://v3-cinemeta.strem.io/catalog/movie/top.json', 50)).toBe(
      'https://v3-cinemeta.strem.io/catalog/movie/top/skip=50.json',
    )
  })
})

describe('normalizeSeriesEpisodes', () => {
  it('unwraps cinemeta meta envelope and maps episode fields', () => {
    const episodes = normalizeSeriesEpisodes({
      meta: {
        videos: [
          { id: 'tt1:1:1', season: 1, number: 1, name: 'Pilot' },
          { id: 'tt1:1:2', season: 1, episode: 2, title: 'Second' },
        ],
      },
    })

    expect(episodes).toEqual([
      expect.objectContaining({ season: 1, episode: 1, title: 'Pilot' }),
      expect.objectContaining({ season: 1, episode: 2, title: 'Second' }),
    ])
  })
})
describe('normalizeMovie', () => {
  it('returns null for non-imdb ids', () => {
    expect(
      normalizeMovie({
        id: 'movie:123',
        name: 'Invalid Movie',
      }),
    ).toBeNull()
  })

  it('uses imdb_id fallback and normalizes shape', () => {
    const normalized = normalizeMovie({
      id: '',
      imdb_id: 'tt1234567',
      name: 'Valid Movie',
      genre: ['Action'],
      imdbRating: 7.6 as unknown as string,
    })

    expect(normalized).toMatchObject({
      id: 'tt1234567',
      name: 'Valid Movie',
      genres: ['Action'],
      imdbRating: '7.6',
    })
  })
})
