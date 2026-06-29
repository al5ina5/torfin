import { filterGenres, genreToCatalogId } from './genres'
import type { CinemetaMovie, ContentType, Movie } from '../types'

const CINEMETA_BASE_URL = 'https://v3-cinemeta.strem.io'
export const CURRENT_RELEASE_YEAR = new Date().getUTCFullYear()

function genreCatalogUrls(contentType: ContentType) {
  const catalogRoot = contentType === 'series' ? 'series' : 'movie'
  return Object.fromEntries(
    filterGenres.map((genre) => [
      genreToCatalogId(genre),
      `${CINEMETA_BASE_URL}/catalog/${catalogRoot}/top/genre=${encodeURIComponent(genre)}.json`,
    ]),
  )
}

const baseMovieCatalogUrls = {
  trending: `${CINEMETA_BASE_URL}/catalog/movie/top.json`,
  topRated: `${CINEMETA_BASE_URL}/catalog/movie/imdbRating.json`,
  featured: `${CINEMETA_BASE_URL}/catalog/movie/top.json`,
  newReleases: `${CINEMETA_BASE_URL}/catalog/movie/year/genre=${encodeURIComponent(String(CURRENT_RELEASE_YEAR))}.json`,
}

const baseSeriesCatalogUrls = {
  trending: `${CINEMETA_BASE_URL}/catalog/series/top.json`,
  topRated: `${CINEMETA_BASE_URL}/catalog/series/imdbRating.json`,
  featured: `${CINEMETA_BASE_URL}/catalog/series/top.json`,
  newReleases: `${CINEMETA_BASE_URL}/catalog/series/year/genre=${encodeURIComponent(String(CURRENT_RELEASE_YEAR))}.json`,
}

export const CINEMETA_CATALOG_URLS = {
  ...baseMovieCatalogUrls,
  ...genreCatalogUrls('movie'),
}

export const CINEMETA_SERIES_CATALOG_URLS = {
  ...baseSeriesCatalogUrls,
  ...genreCatalogUrls('series'),
}

export function searchUrl(query: string, type: ContentType = 'movie') {
  return `${CINEMETA_BASE_URL}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`
}

export function seriesSearchUrl(query: string) {
  return searchUrl(query, 'series')
}

export function metaUrl(type: ContentType, id: string) {
  return `${CINEMETA_BASE_URL}/meta/${type}/${encodeURIComponent(id)}.json`
}

export function catalogPageUrl(url: string, skip: number) {
  if (skip <= 0) return url
  return url.replace('.json', `/skip=${skip}.json`)
}

/** Cinemeta only paginates plain top/imdbRating catalogs; genre and year paths 404 on skip. */
export function catalogSupportsPagination(url: string) {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '')
  if (/\/genre=/.test(path)) return false
  return /\/catalog\/(?:movie|series)\/(?:top|imdbRating)(?:\/skip=\d+)?\.json$/.test(path)
}

export function isCatalogEndError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /\b404\b/i.test(message) || /not found/i.test(message)
}

export function normalizeMovie(movie: CinemetaMovie): Movie | null {
  const id = movie.id || movie.imdb_id
  if (!id?.startsWith('tt')) return null
  return {
    ...movie,
    id,
    type: 'movie',
    name: String(movie.name || movie.title || 'Untitled'),
    genres: movie.genres ?? movie.genre ?? [],
    imdbRating: movie.imdbRating ? String(movie.imdbRating) : undefined,
  }
}

export function normalizeCatalogItem(item: CinemetaMovie, type: ContentType): Movie | null {
  const normalized = normalizeMovie(item)
  if (!normalized) return null
  return { ...normalized, type }
}

export function normalizeSeriesEpisodes(payload: { meta?: { videos?: unknown[] }; videos?: unknown[] } | null | undefined) {
  const videos = payload?.meta?.videos ?? payload?.videos
  if (!Array.isArray(videos)) return []
  return videos
    .map((video) => {
      const entry = video as Record<string, unknown>
      const season = Number(entry.season)
      const episode = Number(entry.episode ?? entry.number)
      if (!Number.isFinite(season) || !Number.isFinite(episode)) return null
      const title = entry.title ?? entry.name
      return {
        id: String(entry.id || ''),
        title: title ? String(title) : undefined,
        overview: entry.overview ? String(entry.overview) : undefined,
        released: entry.released ? String(entry.released) : undefined,
        thumbnail: entry.thumbnail ? String(entry.thumbnail) : undefined,
        season,
        episode,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.season - b.season || a.episode - b.episode)
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((entry) => String(entry)).filter(Boolean)
}

export function enrichMovieFromMeta(movie: Movie, payload: Record<string, unknown> | null | undefined): Movie {
  if (!payload) return movie
  const meta = (payload.meta ?? payload) as Record<string, unknown>
  const cast = stringList(meta.cast)
  const director = stringList(meta.director)
  const runtime = meta.runtime ? String(meta.runtime) : undefined
  const links = Array.isArray(meta.links) ? meta.links : []
  const trailer = links
    .map((link) => link as Record<string, unknown>)
    .find((link) => String(link.category || '').toLowerCase() === 'trailer' && typeof link.url === 'string')
  return {
    ...movie,
    cast: cast.length ? cast : movie.cast,
    director: director.length ? director : movie.director,
    runtime: runtime || movie.runtime,
    trailer: trailer ? String(trailer.url) : movie.trailer,
    background: movie.background || (typeof meta.background === 'string' ? meta.background : undefined),
    description: movie.description || (typeof meta.description === 'string' ? meta.description : undefined),
  }
}

export function similarMoviesFromMeta(payload: Record<string, unknown> | null | undefined, type: ContentType): Movie[] {
  const meta = (payload?.meta ?? payload) as Record<string, unknown> | undefined
  const links = Array.isArray(meta?.links) ? meta.links : []
  return links
    .filter((link) => String((link as Record<string, unknown>).category || '').toLowerCase() === 'similar')
    .map((link) => {
      const entry = link as Record<string, unknown>
      return normalizeCatalogItem(
        {
          id: (entry.imdb_id as string | undefined) ?? (entry.id as string | undefined),
          name: (entry.name as string | undefined) ?? (entry.title as string | undefined),
          poster: entry.poster as string | undefined,
        },
        type,
      )
    })
    .filter((item): item is Movie => Boolean(item))
    .slice(0, 8)
}
