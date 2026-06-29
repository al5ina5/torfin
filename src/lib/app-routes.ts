import { catalogOptions, libraryCatalogOptions } from './movies'
import type { ContentType, PreferencesTab } from '../types'

export type AppRouteModal =
  | { kind: 'settings'; tab: PreferencesTab }
  | { kind: 'downloads' }
  | { kind: 'filters' }
  | { kind: 'legal' }

export type AppRouteTitle = {
  type: ContentType
  id: string
  season?: number
  episode?: number
}

export type AppRoute = {
  contentType: ContentType
  catalogId: string
  presetId?: string
  searchQuery?: string
  title?: AppRouteTitle
  modal?: AppRouteModal
}

/** @deprecated Use AppRoute instead */
export type AppModalRoute = AppRoute

const SETTINGS_TABS: PreferencesTab[] = ['general', 'playback', 'downloads', 'integrations', 'advanced']

const LEGACY_SETTINGS_TABS: Record<string, PreferencesTab> = {
  accounts: 'integrations',
  plugins: 'integrations',
}

function normalizeSettingsTab(value: string | null | undefined): PreferencesTab | null {
  if (!value) return null
  if (SETTINGS_TABS.includes(value as PreferencesTab)) return value as PreferencesTab
  return LEGACY_SETTINGS_TABS[value] ?? null
}

function isPreferencesTab(value: string | null | undefined): value is PreferencesTab {
  return Boolean(normalizeSettingsTab(value))
}

const CATALOG_IDS = new Set<string>([
  ...libraryCatalogOptions.map((option) => option.id),
  ...catalogOptions.map((option) => option.id),
])

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
  if (normalized === '/legal') return { ...fallback, modal: { kind: 'legal' } }

  if (normalized === '/settings' || normalized.startsWith('/settings/')) {
    const segment = normalized.split('/')[2]
    const tabParam = params.get('tab')
    const tab = normalizeSettingsTab(segment)
      ?? normalizeSettingsTab(tabParam)
      ?? 'general'
    return { ...fallback, modal: { kind: 'settings', tab } }
  }

  const settingsParam = params.get('settings')
  if (settingsParam !== null) {
    const tab =
      settingsParam === '' || settingsParam === 'true' || settingsParam === '1'
        ? 'general'
        : normalizeSettingsTab(settingsParam) ?? 'general'
    return { ...fallback, modal: { kind: 'settings', tab } }
  }

  if (params.has('downloads')) return { ...fallback, modal: { kind: 'downloads' } }
  if (params.has('filters')) return { ...fallback, modal: { kind: 'filters' } }
  if (params.has('legal')) return { ...fallback, modal: { kind: 'legal' } }

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

  const presetMatch = normalized.match(/^\/(movies|series)\/preset\/([a-zA-Z0-9-]+)$/)
  if (presetMatch) {
    const contentType: ContentType = presetMatch[1] === 'series' ? 'series' : 'movie'
    return { contentType, catalogId: 'trending', presetId: presetMatch[2] }
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
      case 'legal':
        return '/legal'
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

  if (route.presetId) {
    const prefix = route.contentType === 'series' ? 'series' : 'movies'
    return `/${prefix}/preset/${route.presetId}`
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

  if (typeof route.presetId === 'string' && route.presetId) {
    next.presetId = route.presetId
  }

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
    } else if (modal.kind === 'downloads' || modal.kind === 'filters' || modal.kind === 'legal') {
      next.modal = modal
    }
  }

  return next
}

export function readAppRoute(): AppRoute {
  if (typeof window === 'undefined') return defaultAppRoute()

  const fromUrl = parseAppRoute(window.location.pathname, window.location.search)
  const fromState = normalizeAppRoute(window.history.state?.appRoute)

  if (fromUrl.modal) {
    if (!fromState) return fromUrl
    return {
      ...fromState,
      modal: fromUrl.modal,
      title: fromState.title,
      searchQuery: fromState.searchQuery,
    }
  }

  if (fromUrl.title || fromUrl.searchQuery || fromUrl.presetId || fromUrl.catalogId !== 'trending' || fromUrl.contentType !== 'movie') {
    return fromUrl
  }

  if (fromState && !fromState.modal) return fromState

  return fromUrl
}

export function routesEqual(a: AppRoute, b: AppRoute) {
  return appRouteToUrl(a) === appRouteToUrl(b) && JSON.stringify(a) === JSON.stringify(b)
}

export function writeAppRoute(route: AppRoute, replace = false) {
  if (typeof window === 'undefined') return
  const url = appRouteToUrl(route)
  const currentUrl = `${window.location.pathname}${window.location.search}`
  const currentState = normalizeAppRoute(window.history.state?.appRoute)
  const sameUrl = currentUrl === url
  const sameRoute = currentState && JSON.stringify(currentState) === JSON.stringify(route)

  if (sameUrl && sameRoute) return

  if (replace || sameUrl) {
    window.history.replaceState({ appRoute: route }, '', url)
  } else {
    window.history.pushState({ appRoute: route }, '', url)
  }
}

export function browseRoute(contentType: ContentType, catalogId: string, current?: AppRoute): AppRoute {
  const base = current ?? defaultAppRoute(contentType)
  const { presetId: _presetId, title: _title, searchQuery: _searchQuery, ...rest } = base
  return {
    ...rest,
    contentType,
    catalogId,
    modal: base.modal,
  }
}

export function presetRoute(contentType: ContentType, presetId: string, current?: AppRoute): AppRoute {
  const base = current ?? defaultAppRoute(contentType)
  const { title: _title, searchQuery: _searchQuery, ...rest } = base
  return {
    ...rest,
    contentType,
    catalogId: 'trending',
    presetId,
    modal: base.modal,
  }
}

export function searchRoute(contentType: ContentType, query: string, current?: AppRoute): AppRoute {
  const base = current ?? defaultAppRoute(contentType)
  const { presetId: _presetId, title: _title, ...rest } = base
  return {
    ...rest,
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
    presetId: base.presetId,
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
