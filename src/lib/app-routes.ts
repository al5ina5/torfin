import { catalogOptions, libraryCatalogOptions } from './movies'
import type { ContentType, PreferencesTab } from '../types'

export type AppRouteModal =
  | { kind: 'settings'; tab: PreferencesTab }
  | { kind: 'downloads' }
  | { kind: 'filters' }

export type AppRouteTitle = {
  type: ContentType
  id: string
  season?: number
  episode?: number
}

export type AppRoute = {
  contentType: ContentType
  catalogId: string
  searchQuery?: string
  title?: AppRouteTitle
  modal?: AppRouteModal
}

/** @deprecated Use AppRoute instead */
export type AppModalRoute = AppRoute

const SETTINGS_TABS: PreferencesTab[] = ['general', 'plugins', 'downloads', 'playback']

const CATALOG_IDS = new Set<string>([
  ...libraryCatalogOptions.map((option) => option.id),
  ...catalogOptions.map((option) => option.id),
])

function isPreferencesTab(value: string | null | undefined): value is PreferencesTab {
  return Boolean(value && SETTINGS_TABS.includes(value as PreferencesTab))
}

function isImdbId(value: string) {
  return /^tt\d+$/.test(value)
}

function isCatalogId(value: string) {
  return CATALOG_IDS.has(value)
}

export function defaultAppRoute(contentType: ContentType = 'movie'): AppRoute {
  return { contentType, catalogId: 'trending' }
}

function parseModalRoute(normalized: string, params: URLSearchParams, fallback: AppRoute): AppRoute | null {
  if (normalized === '/downloads') return { ...fallback, modal: { kind: 'downloads' } }
  if (normalized === '/filters') return { ...fallback, modal: { kind: 'filters' } }

  if (normalized === '/settings' || normalized.startsWith('/settings/')) {
    const segment = normalized.split('/')[2]
    const tabParam = params.get('tab')
    const tab = isPreferencesTab(segment)
      ? segment
      : isPreferencesTab(tabParam)
        ? tabParam
        : 'general'
    return { ...fallback, modal: { kind: 'settings', tab } }
  }

  const settingsParam = params.get('settings')
  if (settingsParam !== null) {
    const tab =
      settingsParam === '' || settingsParam === 'true' || settingsParam === '1'
        ? 'general'
        : isPreferencesTab(settingsParam)
          ? settingsParam
          : 'general'
    return { ...fallback, modal: { kind: 'settings', tab } }
  }

  if (params.has('downloads')) return { ...fallback, modal: { kind: 'downloads' } }
  if (params.has('filters')) return { ...fallback, modal: { kind: 'filters' } }

  return null
}

export function parseAppRoute(pathname: string, search = ''): AppRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search)
  const fallback = defaultAppRoute()

  const modalRoute = parseModalRoute(normalized, params, fallback)
  if (modalRoute) return modalRoute

  const movieMatch = normalized.match(/^\/movie\/(tt\d+)$/)
  if (movieMatch) {
    return {
      contentType: 'movie',
      catalogId: 'trending',
      title: { type: 'movie', id: movieMatch[1] },
    }
  }

  const seriesTitleMatch = normalized.match(/^\/series\/(tt\d+)(?:\/(\d+)\/(\d+))?$/)
  if (seriesTitleMatch) {
    const [, id, season, episode] = seriesTitleMatch
    const title: AppRouteTitle = { type: 'series', id }
    if (season && episode) {
      title.season = Number(season)
      title.episode = Number(episode)
    }
    return { contentType: 'series', catalogId: 'trending', title }
  }

  const searchMatch = normalized.match(/^\/(movies|series)\/search$/)
  if (searchMatch) {
    const contentType: ContentType = searchMatch[1] === 'series' ? 'series' : 'movie'
    const query = params.get('q') ?? ''
    return { contentType, catalogId: 'trending', searchQuery: query }
  }

  const browseMatch = normalized.match(/^\/(movies|series)(?:\/([a-zA-Z0-9]+))?$/)
  if (browseMatch) {
    const contentType: ContentType = browseMatch[1] === 'series' ? 'series' : 'movie'
    const segment = browseMatch[2]
    const catalogId = segment && isCatalogId(segment) ? segment : 'trending'
    return { contentType, catalogId }
  }

  if (normalized === '/') {
    const query = params.get('q')
    if (query) return { contentType: 'movie', catalogId: 'trending', searchQuery: query }
    return fallback
  }

  return fallback
}

export function parseAppRouteFromUrl(url: string): AppRoute {
  const parsed = new URL(url, 'http://torfin.local')
  return parseAppRoute(parsed.pathname, parsed.search)
}

export function appRouteToUrl(route: AppRoute): string {
  if (route.modal) {
    switch (route.modal.kind) {
      case 'downloads':
        return '/downloads'
      case 'filters':
        return '/filters'
      case 'settings':
        return route.modal.tab === 'general' ? '/settings' : `/settings/${route.modal.tab}`
    }
  }

  if (route.title) {
    const { type, id, season, episode } = route.title
    if (type === 'movie') return `/movie/${id}`
    if (season != null && episode != null) return `/series/${id}/${season}/${episode}`
    return `/series/${id}`
  }

  if (route.searchQuery !== undefined && route.searchQuery !== '') {
    const prefix = route.contentType === 'series' ? 'series' : 'movies'
    return `/${prefix}/search?q=${encodeURIComponent(route.searchQuery)}`
  }

  const prefix = route.contentType === 'series' ? 'series' : 'movies'
  if (route.catalogId === 'trending') {
    if (route.contentType === 'movie' && route.catalogId === 'trending') return '/'
    return `/${prefix}`
  }
  return `/${prefix}/${route.catalogId}`
}

function normalizeAppRoute(value: unknown): AppRoute | null {
  if (!value || typeof value !== 'object') return null
  const route = value as Partial<AppRoute>
  const contentType = route.contentType === 'series' ? 'series' : 'movie'
  const catalogId = typeof route.catalogId === 'string' && isCatalogId(route.catalogId) ? route.catalogId : 'trending'
  const next: AppRoute = { contentType, catalogId }

  if (typeof route.searchQuery === 'string') {
    next.searchQuery = route.searchQuery
  }

  if (route.title && typeof route.title.id === 'string' && isImdbId(route.title.id)) {
    next.title = {
      type: route.title.type === 'series' ? 'series' : 'movie',
      id: route.title.id,
      ...(typeof route.title.season === 'number' ? { season: route.title.season } : {}),
      ...(typeof route.title.episode === 'number' ? { episode: route.title.episode } : {}),
    }
  }

  if (route.modal && typeof route.modal === 'object' && 'kind' in route.modal) {
    const modal = route.modal as AppRouteModal
    if (modal.kind === 'settings' && isPreferencesTab(modal.tab)) {
      next.modal = { kind: 'settings', tab: modal.tab }
    } else if (modal.kind === 'downloads' || modal.kind === 'filters') {
      next.modal = modal
    }
  }

  return next
}

export function readAppRoute(): AppRoute {
  if (typeof window === 'undefined') return defaultAppRoute()
  const fromState = normalizeAppRoute(window.history.state?.appRoute)
  const fromUrl = parseAppRoute(window.location.pathname, window.location.search)
  if (!fromState) return fromUrl

  if (fromUrl.modal) {
    return { ...fromState, modal: fromUrl.modal }
  }

  const urlHasBrowseOrTitle =
    window.location.pathname !== '/' ||
    Boolean(fromUrl.title) ||
    Boolean(fromUrl.searchQuery) ||
    fromUrl.contentType !== 'movie' ||
    fromUrl.catalogId !== 'trending'

  if (urlHasBrowseOrTitle) {
    return { ...fromUrl, modal: fromState.modal }
  }

  return fromState
}

export function routesEqual(a: AppRoute, b: AppRoute) {
  return appRouteToUrl(a) === appRouteToUrl(b) && JSON.stringify(a) === JSON.stringify(b)
}

export function writeAppRoute(route: AppRoute, replace = false) {
  if (typeof window === 'undefined') return
  const url = appRouteToUrl(route)
  const current = `${window.location.pathname}${window.location.search}`
  if (current === url) {
    if (replace) {
      window.history.replaceState({ appRoute: route }, '', url)
    }
    return
  }
  if (replace) {
    window.history.replaceState({ appRoute: route }, '', url)
  } else {
    window.history.pushState({ appRoute: route }, '', url)
  }
}

export function browseRoute(contentType: ContentType, catalogId: string, current?: AppRoute): AppRoute {
  const base = current ?? defaultAppRoute(contentType)
  return {
    contentType,
    catalogId,
    modal: base.modal,
  }
}

export function searchRoute(contentType: ContentType, query: string, current?: AppRoute): AppRoute {
  const base = current ?? defaultAppRoute(contentType)
  return {
    contentType,
    catalogId: base.catalogId,
    searchQuery: query,
    modal: base.modal,
  }
}

export function titleRoute(
  movie: { type: ContentType; id: string },
  current?: AppRoute,
  season?: number | null,
  episode?: number | null,
): AppRoute {
  const base = current ?? defaultAppRoute(movie.type)
  const title: AppRouteTitle = { type: movie.type, id: movie.id }
  if (season != null && episode != null) {
    title.season = season
    title.episode = episode
  }
  return {
    contentType: base.contentType,
    catalogId: base.catalogId,
    searchQuery: base.searchQuery,
    title,
    modal: base.modal,
  }
}

export function withoutTitle(route: AppRoute): AppRoute {
  const { title: _title, ...rest } = route
  return rest
}

export function withoutModal(route: AppRoute): AppRoute {
  const { modal: _modal, ...rest } = route
  return rest
}

export function withModal(route: AppRoute, modal: AppRouteModal): AppRoute {
  return { ...route, modal }
}
