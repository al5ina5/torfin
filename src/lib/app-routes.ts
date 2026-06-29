import type { PreferencesTab } from '../types'

export type AppModalRoute =
  | { kind: 'none' }
  | { kind: 'settings'; tab: PreferencesTab }
  | { kind: 'downloads' }
  | { kind: 'filters' }

const SETTINGS_TABS: PreferencesTab[] = ['general', 'plugins', 'downloads', 'playback']

function isPreferencesTab(value: string | null | undefined): value is PreferencesTab {
  return Boolean(value && SETTINGS_TABS.includes(value as PreferencesTab))
}

export function parseAppRoute(pathname: string, search = ''): AppModalRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search)

  if (normalized === '/downloads') return { kind: 'downloads' }
  if (normalized === '/filters') return { kind: 'filters' }

  if (normalized === '/settings' || normalized.startsWith('/settings/')) {
    const segment = normalized.split('/')[2]
    const tabParam = params.get('tab')
    const tab = isPreferencesTab(segment)
      ? segment
      : isPreferencesTab(tabParam)
        ? tabParam
        : 'general'
    return { kind: 'settings', tab }
  }

  const settingsParam = params.get('settings')
  if (settingsParam !== null) {
    const tab =
      settingsParam === '' || settingsParam === 'true' || settingsParam === '1'
        ? 'general'
        : isPreferencesTab(settingsParam)
          ? settingsParam
          : 'general'
    return { kind: 'settings', tab }
  }

  if (params.has('downloads')) return { kind: 'downloads' }
  if (params.has('filters')) return { kind: 'filters' }

  return { kind: 'none' }
}

export function appRouteToUrl(route: AppModalRoute): string {
  switch (route.kind) {
    case 'none':
      return '/'
    case 'downloads':
      return '/downloads'
    case 'filters':
      return '/filters'
    case 'settings':
      return route.tab === 'general' ? '/settings' : `/settings/${route.tab}`
  }
}

export function readAppRoute(): AppModalRoute {
  if (typeof window === 'undefined') return { kind: 'none' }
  return parseAppRoute(window.location.pathname, window.location.search)
}

export function writeAppRoute(route: AppModalRoute, replace = false) {
  if (typeof window === 'undefined') return
  const url = appRouteToUrl(route)
  const current = `${window.location.pathname}${window.location.search}`
  if (current === url || (current === '/' && url === '/')) return
  if (replace) {
    window.history.replaceState({ appRoute: route }, '', url)
  } else {
    window.history.pushState({ appRoute: route }, '', url)
  }
}
