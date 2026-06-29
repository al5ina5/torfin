import { describe, expect, it } from 'vitest'

import { CINEMETA_CATALOG_URLS, CINEMETA_SERIES_CATALOG_URLS, CURRENT_RELEASE_YEAR } from '../cinemeta'
import { builtInFilterPresets } from '../filter-presets'
import { catalogOptions, catalogUrlWithFilters, defaultMovieFilters, effectiveMovieFilters, filterAndSortMovies } from '../movies'
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

describe('catalogUrlWithFilters', () => {
  const trending = CINEMETA_CATALOG_URLS.trending

  it('routes genre presets to a paginatable catalog with client-side filtering', () => {
    const horror = builtInFilterPresets.find((preset) => preset.id === 'builtin-top-horror')!
    expect(catalogUrlWithFilters(trending, horror.filters, 'movie', 'trending')).toBe(
      'https://v3-cinemeta.strem.io/catalog/movie/top.json#genre:Horror&minRating:7&sort:ratingDesc',
    )
  })

  it('routes sidebar genre catalogs to a paginatable catalog', () => {
    const horrorUrl = CINEMETA_CATALOG_URLS.horror as string
    expect(catalogUrlWithFilters(horrorUrl, defaultMovieFilters, 'movie', 'horror')).toBe(
      'https://v3-cinemeta.strem.io/catalog/movie/top.json#catalog:horror&genre:Horror',
    )
  })

  it('routes decade presets to a representative year catalog', () => {
    const nineties = builtInFilterPresets.find((preset) => preset.id === 'builtin-90s-classics')!
    expect(catalogUrlWithFilters(trending, nineties.filters, 'movie')).toContain('/catalog/movie/year/genre=1995.json')

    const newDecade = builtInFilterPresets.find((preset) => preset.id === 'builtin-new-this-decade')!
    expect(catalogUrlWithFilters(trending, newDecade.filters, 'movie')).toContain(
      `/catalog/movie/year/genre=${CURRENT_RELEASE_YEAR}.json`,
    )
  })

  it('keeps the sidebar catalog when no preset overrides apply', () => {
    expect(
      catalogUrlWithFilters(trending, { apiCatalog: '', genre: '', releaseYear: '', yearFrom: '', yearTo: '', minRating: '', sortBy: 'catalog' }, 'movie'),
    ).toBe(trending)
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

  it('applies genre from sidebar genre catalogs', () => {
    expect(effectiveMovieFilters('horror', defaultMovieFilters).genre).toBe('Horror')
    expect(effectiveMovieFilters('sciFi', defaultMovieFilters).genre).toBe('Sci-Fi')
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
