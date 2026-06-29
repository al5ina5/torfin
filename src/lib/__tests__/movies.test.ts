import { describe, expect, it } from 'vitest'

import { CINEMETA_CATALOG_URLS, CINEMETA_SERIES_CATALOG_URLS } from '../cinemeta'
import { catalogOptions, effectiveMovieFilters, filterAndSortMovies } from '../movies'
import type { Movie } from '../../types'

describe('catalog URLs', () => {
  it('maps each Now filter to a distinct Cinemeta catalog', () => {
    const nowIds = catalogOptions.filter((option) => option.group === 'Now').map((option) => option.id)

    expect(nowIds.map((id) => CINEMETA_CATALOG_URLS[id as keyof typeof CINEMETA_CATALOG_URLS])).toEqual([
      CINEMETA_CATALOG_URLS.trending,
      CINEMETA_CATALOG_URLS.topRated,
      CINEMETA_CATALOG_URLS.featured,
      CINEMETA_CATALOG_URLS.newReleases,
    ])

    expect(CINEMETA_CATALOG_URLS.trending).toContain('/catalog/movie/top.json')
    expect(CINEMETA_CATALOG_URLS.topRated).toContain('/catalog/movie/imdbRating.json')
    expect(CINEMETA_CATALOG_URLS.featured).toContain('/catalog/movie/top.json')
    expect(CINEMETA_CATALOG_URLS.topRated).not.toBe(CINEMETA_CATALOG_URLS.featured)
    expect(CINEMETA_CATALOG_URLS.trending).not.toBe(CINEMETA_CATALOG_URLS.topRated)
  })

  it('uses matching series catalog endpoints', () => {
    expect(CINEMETA_SERIES_CATALOG_URLS.trending).toContain('/catalog/series/top.json')
    expect(CINEMETA_SERIES_CATALOG_URLS.topRated).toContain('/catalog/series/imdbRating.json')
    expect(CINEMETA_SERIES_CATALOG_URLS.featured).toContain('/catalog/series/top.json')
  })
})

describe('effectiveMovieFilters', () => {
  it('requires a minimum rating for featured without overriding user filters', () => {
    expect(effectiveMovieFilters('featured', { apiCatalog: '', genre: '', releaseYear: '', yearFrom: '', yearTo: '', minRating: '', sortBy: 'catalog' }).minRating).toBe('7')
    expect(
      effectiveMovieFilters('featured', {
        apiCatalog: '',
        genre: '',
        releaseYear: '',
        yearFrom: '',
        yearTo: '',
        minRating: '8',
        sortBy: 'catalog',
      }).minRating,
    ).toBe('8')
    expect(effectiveMovieFilters('trending', { apiCatalog: '', genre: '', releaseYear: '', yearFrom: '', yearTo: '', minRating: '', sortBy: 'catalog' }).minRating).toBe('')
  })

  it('filters featured results differently from trending', () => {
    const movies: Movie[] = [
      { id: 'tt1', type: 'movie', name: 'Popular Unrated', genres: [] },
      { id: 'tt2', type: 'movie', name: 'Popular Hit', genres: [], imdbRating: '8.1' },
    ]

    const trending = filterAndSortMovies(movies, effectiveMovieFilters('trending', { apiCatalog: '', genre: '', releaseYear: '', yearFrom: '', yearTo: '', minRating: '', sortBy: 'catalog' }))
    const featured = filterAndSortMovies(movies, effectiveMovieFilters('featured', { apiCatalog: '', genre: '', releaseYear: '', yearFrom: '', yearTo: '', minRating: '', sortBy: 'catalog' }))

    expect(trending).toHaveLength(2)
    expect(featured).toHaveLength(1)
    expect(featured[0]?.name).toBe('Popular Hit')
  })
})
