import { buildExternalLinks, mergeCreditNames } from './external-links'
import { filterGenres, genreToCatalogId } from './genres'
import type { CinemetaMovie, ContentType, Movie, TitlePopularities } from '../types'

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

function catalogApiPath(url: string) {
  return url.split('#')[0].replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '')
}

export function catalogPageUrl(url: string, skip: number) {
  const apiUrl = url.split('#')[0]
  if (skip <= 0) return apiUrl
  return apiUrl.replace('.json', `/skip=${skip}.json`)
}

/** Cinemeta only paginates plain top/imdbRating catalogs; genre and year paths 404 on skip. */
export function catalogSupportsPagination(url: string) {
  const path = catalogApiPath(url)
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

export function youtubeTrailerUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId.trim())}`
}

export function youtubeTrailerEmbedUrl(videoId: string) {
  const id = videoId.trim()
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`
}

export function youtubeVideoIdFromUrl(url: string): string | undefined {
  const value = url.trim()
  if (!value) return undefined

  try {
    const parsed = new URL(value)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id || undefined
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v')
        return id?.trim() || undefined
      }
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/?]+)/)
      if (embedMatch?.[1]) return embedMatch[1]
    }
  } catch {
    return undefined
  }

  return undefined
}

export function trailerSearchUrl(name: string, releaseInfo?: string, type: ContentType = 'movie') {
  const label = type === 'series' ? 'official trailer' : 'trailer'
  const query = [name, releaseInfo, label].filter(Boolean).join(' ')
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

function linkFromMeta(meta: Record<string, unknown>, category: string): string | undefined {
  const links = Array.isArray(meta.links) ? meta.links : []
  const match = links
    .map((entry) => entry as Record<string, unknown>)
    .find(
      (entry) =>
        String(entry.category || '').toLowerCase() === category.toLowerCase() && typeof entry.url === 'string',
    )
  return match ? String(match.url) : undefined
}

function linkNamesFromMeta(meta: Record<string, unknown>, category: string) {
  const links = Array.isArray(meta.links) ? meta.links : []
  return links
    .filter((entry) => String((entry as Record<string, unknown>).category || '').toLowerCase() === category.toLowerCase())
    .map((entry) => String((entry as Record<string, unknown>).name || '').trim())
    .filter(Boolean)
}

function parsePopularities(value: unknown): TitlePopularities | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Record<string, unknown>
  const popularities: TitlePopularities = {}
  for (const key of ['moviedb', 'stremio', 'trakt', 'stremio_lib'] as const) {
    const score = Number(source[key])
    if (Number.isFinite(score)) popularities[key] = score
  }
  return Object.keys(popularities).length ? popularities : undefined
}

function parsePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.round(parsed)
}

function formatReleasedDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function extractTrailerFromMeta(meta: Record<string, unknown>): string | undefined {
  const trailerStreams = Array.isArray(meta.trailerStreams) ? meta.trailerStreams : []
  for (const stream of trailerStreams) {
    const ytId = (stream as Record<string, unknown>).ytId
    if (typeof ytId === 'string' && ytId.trim()) return youtubeTrailerUrl(ytId)
  }

  const trailers = Array.isArray(meta.trailers) ? meta.trailers : []
  for (const trailer of trailers) {
    const source = (trailer as Record<string, unknown>).source
    if (typeof source === 'string' && source.trim()) return youtubeTrailerUrl(source)
  }

  const links = Array.isArray(meta.links) ? meta.links : []
  const link = links
    .map((entry) => entry as Record<string, unknown>)
    .find((entry) => String(entry.category || '').toLowerCase() === 'trailer' && typeof entry.url === 'string')
  if (link) return String(link.url)

  return undefined
}

export function enrichMovieFromMeta(movie: Movie, payload: Record<string, unknown> | null | undefined): Movie {
  if (!payload) return movie
  const meta = (payload.meta ?? payload) as Record<string, unknown>
  const cast = mergeCreditNames(linkNamesFromMeta(meta, 'Cast'), stringList(meta.cast))
  const director = mergeCreditNames(linkNamesFromMeta(meta, 'Directors'), stringList(meta.director))
  const writer = mergeCreditNames(linkNamesFromMeta(meta, 'Writers'), stringList(meta.writer))
  const genres = stringList(meta.genres ?? meta.genre)
  const runtime = meta.runtime ? String(meta.runtime) : undefined
  const country = typeof meta.country === 'string' ? meta.country : undefined
  const awards = typeof meta.awards === 'string' ? meta.awards : undefined
  const status = typeof meta.status === 'string' ? meta.status : undefined
  const logo = typeof meta.logo === 'string' ? meta.logo : undefined
  const slug = typeof meta.slug === 'string' ? meta.slug : undefined
  const released = formatReleasedDate(meta.released)
  const dvdRelease = formatReleasedDate(meta.dvdRelease)
  const movieDbId = parsePositiveInt(meta.moviedb_id)
  const tvdbId = parsePositiveInt(meta.tvdb_id)
  const popularities = parsePopularities(meta.popularities)
  const imdbUrl = linkFromMeta(meta, 'imdb') ?? (movie.id.startsWith('tt') ? `https://imdb.com/title/${movie.id}` : undefined)
  const shareUrl = linkFromMeta(meta, 'share')
  const trailer =
    extractTrailerFromMeta(meta) ??
    movie.trailer ??
    trailerSearchUrl(movie.name, movie.releaseInfo, movie.type)

  const enriched: Movie = {
    ...movie,
    cast: cast.length ? cast : movie.cast,
    director: director.length ? director : movie.director,
    writer: writer.length ? writer : movie.writer,
    genres: genres.length ? genres : movie.genres,
    runtime: runtime || movie.runtime,
    country: country || movie.country,
    awards: awards || movie.awards,
    status: status || movie.status,
    logo: logo || movie.logo,
    slug: slug || movie.slug,
    released: released || movie.released,
    dvdRelease: dvdRelease || movie.dvdRelease,
    movieDbId: movieDbId || movie.movieDbId,
    tvdbId: tvdbId || movie.tvdbId,
    popularities: popularities || movie.popularities,
    imdbUrl: imdbUrl || movie.imdbUrl,
    shareUrl: shareUrl || movie.shareUrl,
    trailer,
    background: movie.background || (typeof meta.background === 'string' ? meta.background : undefined),
    description: movie.description || (typeof meta.description === 'string' ? meta.description : undefined),
  }

  return {
    ...enriched,
    externalLinks: buildExternalLinks(enriched),
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
