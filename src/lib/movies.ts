import {
  CINEMETA_CATALOG_URLS,
  CINEMETA_SERIES_CATALOG_URLS,
  CURRENT_RELEASE_YEAR,
} from './cinemeta'
import { genreCatalogOptions } from './genres'
import type { ContentType, LibraryCatalogId, Movie, MovieFilters } from '../types'

export { filterGenres } from './genres'

export type CatalogOptionId = (typeof catalogOptions)[number]['id'] | LibraryCatalogId

export const libraryCatalogOptions = [
  { id: 'watchlist' as const, group: 'Library', label: 'Watchlist', shortLabel: 'Watchlist' },
  { id: 'continue' as const, group: 'Library', label: 'Continue Watching', shortLabel: 'Continue' },
  { id: 'recent' as const, group: 'Library', label: 'Recently Viewed', shortLabel: 'Recent' },
]

export function isLibraryCatalog(catalogId: string) {
  return catalogId === 'watchlist' || catalogId === 'continue' || catalogId === 'recent'
}

export const catalogOptions = [
  { id: 'trending', group: 'Now', label: 'Trending', shortLabel: 'Trending' },
  { id: 'topRated', group: 'Now', label: 'Top Rated', shortLabel: 'Top Rated' },
  { id: 'featured', group: 'Now', label: 'Featured', shortLabel: 'Featured' },
  { id: 'newReleases', group: 'Now', label: 'New Releases', shortLabel: 'New' },
  ...genreCatalogOptions,
] as const

const catalogPresetFilters: Partial<Record<CatalogOptionId, Partial<MovieFilters>>> = {
  featured: { minRating: '7' },
}

export function isGenreCatalogId(catalogId: string) {
  return genreCatalogOptions.some((option) => option.id === catalogId)
}

export function genreLabelFromCatalogId(catalogId: string) {
  return genreCatalogOptions.find((option) => option.id === catalogId)?.label ?? ''
}

export function effectiveMovieFilters(catalogId: string, filters: MovieFilters): MovieFilters {
  const preset = catalogPresetFilters[catalogId as CatalogOptionId] ?? {}
  const catalogGenre = isGenreCatalogId(catalogId) ? genreLabelFromCatalogId(catalogId) : ''
  return {
    ...filters,
    genre: filters.genre || catalogGenre,
    minRating: filters.minRating || preset.minRating || '',
  }
}

export const filterYears = Array.from({ length: 120 }, (_, index) => String(CURRENT_RELEASE_YEAR - index))

export const defaultMovieFilters: MovieFilters = {
  apiCatalog: '',
  genre: '',
  releaseYear: '',
  yearFrom: '',
  yearTo: '',
  minRating: '',
  sortBy: 'catalog',
}

export function movieYear(movie: Movie) {
  const match = String(movie.releaseInfo ?? '').match(/\d{4}/)
  return match ? Number(match[0]) : Number.NaN
}

export function movieRating(movie: Movie) {
  const rating = Number(movie.imdbRating)
  return Number.isFinite(rating) ? rating : Number.NaN
}

function yearCatalogUrl(catalogRoot: 'movie' | 'series', year: number) {
  return `https://v3-cinemeta.strem.io/catalog/${catalogRoot}/year/genre=${encodeURIComponent(String(year))}.json`
}

function paginatableCatalogUrl(contentType: ContentType, baseUrl: string) {
  const catalogRoot = contentType === 'series' ? 'series' : 'movie'
  const kind = baseUrl.includes('imdbRating') ? 'imdbRating' : 'top'
  return `https://v3-cinemeta.strem.io/catalog/${catalogRoot}/${kind}.json`
}

function isGenreCatalogUrl(url: string) {
  return /\/genre=/.test(url.replace(/^https?:\/\/[^/]+/, ''))
}

function catalogViewKey(apiUrl: string, catalogId: string, filters: MovieFilters, baseUrl: string) {
  const parts: string[] = []
  if (isGenreCatalogId(catalogId)) parts.push(`catalog:${catalogId}`)
  if (filters.genre) parts.push(`genre:${filters.genre}`)
  if (filters.yearFrom) parts.push(`yearFrom:${filters.yearFrom}`)
  if (filters.yearTo) parts.push(`yearTo:${filters.yearTo}`)
  if (filters.minRating) parts.push(`minRating:${filters.minRating}`)
  if (filters.sortBy && filters.sortBy !== 'catalog') parts.push(`sort:${filters.sortBy}`)
  if (parts.length === 0) return apiUrl
  if (parts.length === 1 && parts[0] === `catalog:${catalogId}` && apiUrl === baseUrl) return apiUrl
  return `${apiUrl}#${parts.join('&')}`
}

function representativeYearForRange(filters: MovieFilters) {
  const from = filters.yearFrom ? Number(filters.yearFrom) : Number.NaN
  const to = filters.yearTo ? Number(filters.yearTo) : Number.NaN
  if (Number.isFinite(from) && Number.isFinite(to)) {
    if (filters.sortBy === 'yearAsc') return from
    if (filters.sortBy === 'yearDesc') return to
    return Math.round((from + to) / 2)
  }
  if (Number.isFinite(from)) {
    return filters.sortBy === 'yearDesc' ? CURRENT_RELEASE_YEAR : from
  }
  if (Number.isFinite(to)) return to
  return CURRENT_RELEASE_YEAR
}

export function catalogUrlWithFilters(
  baseUrl: string,
  filters: MovieFilters,
  contentType: ContentType,
  catalogId = '',
) {
  const effective = effectiveMovieFilters(catalogId, filters)
  const catalogRoot = contentType === 'series' ? 'series' : 'movie'

  if (effective.apiCatalog === 'year' || effective.releaseYear) {
    const year = effective.releaseYear || String(CURRENT_RELEASE_YEAR)
    return yearCatalogUrl(catalogRoot, Number(year))
  }

  if (effective.genre) {
    const apiUrl = paginatableCatalogUrl(contentType, baseUrl)
    return catalogViewKey(apiUrl, catalogId, effective, baseUrl)
  }

  if (effective.apiCatalog) {
    return `https://v3-cinemeta.strem.io/catalog/${catalogRoot}/${effective.apiCatalog}.json`
  }

  if (effective.yearFrom || effective.yearTo) {
    return yearCatalogUrl(catalogRoot, representativeYearForRange(effective))
  }

  if (isGenreCatalogUrl(baseUrl) || isGenreCatalogId(catalogId)) {
    const apiUrl = paginatableCatalogUrl(contentType, baseUrl)
    return catalogViewKey(apiUrl, catalogId, effective, baseUrl)
  }

  return baseUrl
}

export function appendUniqueMovies(current: Movie[], incoming: Movie[]) {
  const seen = new Set(current.map((movie) => `${movie.type}:${movie.id}`))
  return [...current, ...incoming.filter((movie) => !seen.has(`${movie.type}:${movie.id}`))]
}

export function filterAndSortMovies(movies: Movie[], filters: MovieFilters) {
  const genre = filters.genre.toLowerCase()
  const yearFrom = filters.yearFrom ? Number(filters.yearFrom) : Number.NaN
  const yearTo = filters.yearTo ? Number(filters.yearTo) : Number.NaN
  const minRating = filters.minRating ? Number(filters.minRating) : Number.NaN

  return movies
    .filter((movie) => {
      const year = movieYear(movie)
      const rating = movieRating(movie)
      if (genre && !(movie.genres ?? []).some((item) => item.toLowerCase() === genre)) return false
      if (Number.isFinite(yearFrom) && (!Number.isFinite(year) || year < yearFrom)) return false
      if (Number.isFinite(yearTo) && (!Number.isFinite(year) || year > yearTo)) return false
      if (Number.isFinite(minRating) && (!Number.isFinite(rating) || rating < minRating)) return false
      return true
    })
    .sort((left, right) => {
      if (filters.sortBy === 'ratingDesc') return (movieRating(right) || 0) - (movieRating(left) || 0)
      if (filters.sortBy === 'yearDesc') return (movieYear(right) || 0) - (movieYear(left) || 0)
      if (filters.sortBy === 'yearAsc') return (movieYear(left) || 9999) - (movieYear(right) || 9999)
      if (filters.sortBy === 'titleAsc') return left.name.localeCompare(right.name)
      return 0
    })
}

export function catalogUrlMap(contentType: ContentType) {
  return contentType === 'series' ? CINEMETA_SERIES_CATALOG_URLS : CINEMETA_CATALOG_URLS
}
