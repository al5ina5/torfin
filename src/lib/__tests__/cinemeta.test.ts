import { describe, expect, it } from 'vitest'

import {
  catalogPageUrl,
  catalogSupportsPagination,
  enrichMovieFromMeta,
  isCatalogEndError,
  normalizeMovie,
  normalizeSeriesEpisodes,
  trailerSearchUrl,
  youtubeTrailerEmbedUrl,
  youtubeTrailerUrl,
  youtubeVideoIdFromUrl,
} from '../cinemeta'

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
    expect(catalogPageUrl('https://v3-cinemeta.strem.io/catalog/movie/top.json#genre:Horror', 50)).toBe(
      'https://v3-cinemeta.strem.io/catalog/movie/top/skip=50.json',
    )
  })
})

describe('catalogSupportsPagination', () => {
  it('allows top and imdbRating catalogs', () => {
    expect(catalogSupportsPagination('https://v3-cinemeta.strem.io/catalog/movie/top.json')).toBe(true)
    expect(catalogSupportsPagination('https://v3-cinemeta.strem.io/catalog/movie/top/skip=50.json')).toBe(true)
    expect(catalogSupportsPagination('https://v3-cinemeta.strem.io/catalog/movie/imdbRating.json')).toBe(true)
  })

  it('disallows genre and year catalogs that 404 on skip', () => {
    expect(catalogSupportsPagination('https://v3-cinemeta.strem.io/catalog/movie/top/genre=Horror.json')).toBe(false)
    expect(catalogSupportsPagination('https://v3-cinemeta.strem.io/catalog/movie/year/genre=1995.json')).toBe(false)
  })
})

describe('isCatalogEndError', () => {
  it('detects pagination end responses', () => {
    expect(isCatalogEndError(new Error('404 Not Found'))).toBe(true)
    expect(isCatalogEndError('not found')).toBe(true)
    expect(isCatalogEndError(new Error('Request timed out'))).toBe(false)
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
describe('enrichMovieFromMeta', () => {
  const baseMovie = {
    id: 'tt1375666',
    type: 'movie' as const,
    name: 'Inception',
    releaseInfo: '2010',
  }

  it('reads trailerStreams ytId from cinemeta meta', () => {
    const enriched = enrichMovieFromMeta(baseMovie, {
      meta: {
        trailerStreams: [{ title: 'Inception', ytId: 'cdx31ak4KbQ' }],
      },
    })

    expect(enriched.trailer).toBe(youtubeTrailerUrl('cdx31ak4KbQ'))
  })

  it('falls back to trailers source when trailerStreams is missing', () => {
    const enriched = enrichMovieFromMeta(baseMovie, {
      meta: {
        trailers: [{ source: 'JE9z-gy4De4', type: 'Trailer' }],
      },
    })

    expect(enriched.trailer).toBe(youtubeTrailerUrl('JE9z-gy4De4'))
  })

  it('uses youtube search when cinemeta has no trailer data', () => {
    const enriched = enrichMovieFromMeta(baseMovie, { meta: { cast: ['Leonardo DiCaprio'] } })

    expect(enriched.trailer).toBe(trailerSearchUrl('Inception', '2010', 'movie'))
  })

  it('enriches additional cinemeta metadata fields', () => {
    const enriched = enrichMovieFromMeta(baseMovie, {
      meta: {
        writer: ['Christopher Nolan'],
        country: 'United Kingdom, United States',
        awards: 'Won 4 Oscars.',
        logo: 'https://images.metahub.space/logo/medium/tt1375666/img',
        released: '2010-07-16T00:00:00.000Z',
        dvdRelease: '2013-06-20T00:00:00.000Z',
        moviedb_id: 27205,
        genres: ['Action', 'Sci-Fi'],
        popularities: { trakt: 85, moviedb: 38.8, stremio: 1.29 },
        links: [
          { category: 'imdb', url: 'https://imdb.com/title/tt1375666' },
          { category: 'share', url: 'https://www.strem.io/s/movie/inception-1375666' },
          { category: 'Cast', name: 'Leonardo DiCaprio' },
          { category: 'Directors', name: 'Christopher Nolan' },
        ],
      },
    })

    expect(enriched).toMatchObject({
      writer: ['Christopher Nolan'],
      country: 'United Kingdom, United States',
      awards: 'Won 4 Oscars.',
      logo: 'https://images.metahub.space/logo/medium/tt1375666/img',
      genres: ['Action', 'Sci-Fi'],
      imdbUrl: 'https://imdb.com/title/tt1375666',
      shareUrl: 'https://www.strem.io/s/movie/inception-1375666',
      movieDbId: 27205,
      cast: ['Leonardo DiCaprio'],
      director: ['Christopher Nolan'],
      popularities: { trakt: 85, moviedb: 38.8, stremio: 1.29 },
    })
    expect(enriched.released).toMatch(/2010/)
    expect(enriched.dvdRelease).toMatch(/2013/)
    expect(enriched.externalLinks?.some((link) => link.id === 'tmdb')).toBe(true)
  })
})

describe('youtubeVideoIdFromUrl', () => {
  it('parses common youtube trailer urls', () => {
    expect(youtubeVideoIdFromUrl('https://www.youtube.com/watch?v=cdx31ak4KbQ')).toBe('cdx31ak4KbQ')
    expect(youtubeVideoIdFromUrl('https://youtu.be/cdx31ak4KbQ')).toBe('cdx31ak4KbQ')
    expect(youtubeVideoIdFromUrl('https://www.youtube-nocookie.com/embed/cdx31ak4KbQ')).toBeUndefined()
    expect(youtubeVideoIdFromUrl('https://www.youtube.com/results?search_query=inception')).toBeUndefined()
  })

  it('builds privacy-friendly embed urls', () => {
    expect(youtubeTrailerEmbedUrl('cdx31ak4KbQ')).toContain('youtube-nocookie.com/embed/cdx31ak4KbQ')
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
