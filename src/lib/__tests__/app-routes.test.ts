import { describe, expect, it } from 'vitest'

import { appRouteToUrl, parseAppRoute } from '../app-routes'

describe('parseAppRoute', () => {
  it('parses settings paths and query tabs', () => {
    expect(parseAppRoute('/settings')).toEqual({ kind: 'settings', tab: 'general' })
    expect(parseAppRoute('/settings/plugins')).toEqual({ kind: 'settings', tab: 'plugins' })
    expect(parseAppRoute('/settings/downloads')).toEqual({ kind: 'settings', tab: 'downloads' })
    expect(parseAppRoute('/settings', '?tab=playback')).toEqual({ kind: 'settings', tab: 'playback' })
    expect(parseAppRoute('/', '?settings=plugins')).toEqual({ kind: 'settings', tab: 'plugins' })
  })

  it('parses downloads and filters routes', () => {
    expect(parseAppRoute('/downloads')).toEqual({ kind: 'downloads' })
    expect(parseAppRoute('/', '?downloads')).toEqual({ kind: 'downloads' })
    expect(parseAppRoute('/filters')).toEqual({ kind: 'filters' })
  })

  it('returns none for the home route', () => {
    expect(parseAppRoute('/')).toEqual({ kind: 'none' })
  })
})

describe('appRouteToUrl', () => {
  it('round-trips modal routes', () => {
    const routes = [
      { kind: 'none' as const },
      { kind: 'downloads' as const },
      { kind: 'filters' as const },
      { kind: 'settings' as const, tab: 'general' as const },
      { kind: 'settings' as const, tab: 'plugins' as const },
    ]
    for (const route of routes) {
      expect(parseAppRoute(appRouteToUrl(route))).toEqual(route)
    }
  })
})
