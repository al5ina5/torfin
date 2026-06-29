import { describe, expect, it } from 'vitest'

import {
  appRouteToUrl,
  browseRoute,
  parseAppRoute,
  parseAppRouteFromUrl,
  searchRoute,
  titleRoute,
  withoutModal,
  withoutTitle,
  withModal,
} from '../app-routes'

describe('parseAppRoute', () => {
  it('parses settings paths and query tabs', () => {
    expect(parseAppRoute('/settings')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      modal: { kind: 'settings', tab: 'general' },
    })
    expect(parseAppRoute('/settings/plugins')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      modal: { kind: 'settings', tab: 'plugins' },
    })
    expect(parseAppRoute('/settings', '?tab=playback')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      modal: { kind: 'settings', tab: 'playback' },
    })
    expect(parseAppRoute('/', '?settings=plugins')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      modal: { kind: 'settings', tab: 'plugins' },
    })
  })

  it('parses downloads and filters routes', () => {
    expect(parseAppRoute('/downloads')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      modal: { kind: 'downloads' },
    })
    expect(parseAppRoute('/', '?downloads')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      modal: { kind: 'downloads' },
    })
    expect(parseAppRoute('/filters')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      modal: { kind: 'filters' },
    })
  })

  it('parses browse routes', () => {
    expect(parseAppRoute('/')).toEqual({ contentType: 'movie', catalogId: 'trending' })
    expect(parseAppRoute('/movies')).toEqual({ contentType: 'movie', catalogId: 'trending' })
    expect(parseAppRoute('/movies/action')).toEqual({ contentType: 'movie', catalogId: 'action' })
    expect(parseAppRoute('/series')).toEqual({ contentType: 'series', catalogId: 'trending' })
    expect(parseAppRoute('/series/comedy')).toEqual({ contentType: 'series', catalogId: 'comedy' })
    expect(parseAppRoute('/movies/watchlist')).toEqual({ contentType: 'movie', catalogId: 'watchlist' })
  })

  it('parses search routes', () => {
    expect(parseAppRoute('/movies/search', '?q=matrix')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      searchQuery: 'matrix',
    })
    expect(parseAppRoute('/series/search', '?q=office')).toEqual({
      contentType: 'series',
      catalogId: 'trending',
      searchQuery: 'office',
    })
  })

  it('parses title routes', () => {
    expect(parseAppRoute('/movie/tt0111161')).toEqual({
      contentType: 'movie',
      catalogId: 'trending',
      title: { type: 'movie', id: 'tt0111161' },
    })
    expect(parseAppRoute('/series/tt0944947')).toEqual({
      contentType: 'series',
      catalogId: 'trending',
      title: { type: 'series', id: 'tt0944947' },
    })
    expect(parseAppRoute('/series/tt0944947/1/5')).toEqual({
      contentType: 'series',
      catalogId: 'trending',
      title: { type: 'series', id: 'tt0944947', season: 1, episode: 5 },
    })
  })
})

describe('appRouteToUrl', () => {
  it('round-trips modal routes', () => {
    const routes = [
      { contentType: 'movie' as const, catalogId: 'trending' },
      { contentType: 'movie' as const, catalogId: 'trending', modal: { kind: 'downloads' as const } },
      { contentType: 'movie' as const, catalogId: 'trending', modal: { kind: 'filters' as const } },
      { contentType: 'movie' as const, catalogId: 'trending', modal: { kind: 'settings' as const, tab: 'general' as const } },
      { contentType: 'movie' as const, catalogId: 'trending', modal: { kind: 'settings' as const, tab: 'plugins' as const } },
    ]
    for (const route of routes) {
      expect(parseAppRoute(appRouteToUrl(route))).toEqual(route)
    }
  })

  it('round-trips browse and title routes', () => {
    const routes = [
      browseRoute('movie', 'action'),
      browseRoute('series', 'horror'),
      browseRoute('movie', 'watchlist'),
      searchRoute('movie', 'inception'),
      titleRoute({ type: 'movie', id: 'tt1375666' }),
      titleRoute({ type: 'series', id: 'tt0944947' }, undefined, 2, 3),
    ]
    for (const route of routes) {
      expect(parseAppRouteFromUrl(appRouteToUrl(route))).toEqual(route)
    }
  })

  it('preserves browse context in helpers', () => {
    const current = searchRoute('series', 'office')
    const withTitle = titleRoute({ type: 'series', id: 'tt0386676' }, current)
    expect(withTitle.contentType).toBe('series')
    expect(withTitle.searchQuery).toBe('office')
    expect(appRouteToUrl(withTitle)).toBe('/series/tt0386676')

    const closed = withoutTitle(withTitle)
    expect(appRouteToUrl(closed)).toBe('/series/search?q=office')

    const modal = withModal(withTitle, { kind: 'downloads' })
    expect(appRouteToUrl(modal)).toBe('/downloads')
    expect(withoutModal(modal).title?.id).toBe('tt0386676')
  })
})
