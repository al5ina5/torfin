import { useCallback, useEffect, useState } from 'react'

import {
  appRouteToUrl,
  browseRoute,
  presetRoute,
  readAppRoute,
  searchRoute,
  titleRoute,
  withoutModal,
  withoutTitle,
  withModal,
  writeAppRoute,
  type AppRoute,
  type AppRouteModal,
} from '../lib/app-routes'
import type { ContentType, Movie, PreferencesTab } from '../types'

export function useAppModalRoute() {
  const [route, setRoute] = useState<AppRoute>(() => readAppRoute())

  useEffect(() => {
    const onPopState = () => setRoute(readAppRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: AppRoute | ((current: AppRoute) => AppRoute), replace = false) => {
    setRoute((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      writeAppRoute(resolved, replace)
      return resolved
    })
  }, [])

  const closeModal = useCallback(() => navigate((current) => withoutModal(current)), [navigate])

  const openSettings = useCallback(
    (tab: PreferencesTab = 'general', replace = false) =>
      navigate((current) => withModal(current, { kind: 'settings', tab }), replace),
    [navigate],
  )

  const openDownloads = useCallback(() => navigate((current) => withModal(current, { kind: 'downloads' })), [navigate])
  const openFilters = useCallback(() => navigate((current) => withModal(current, { kind: 'filters' })), [navigate])
  const openLegal = useCallback(() => navigate((current) => withModal(current, { kind: 'legal' })), [navigate])

  const setSettingsTab = useCallback(
    (tab: PreferencesTab) => navigate((current) => withModal(current, { kind: 'settings', tab }), true),
    [navigate],
  )

  const navigateBrowse = useCallback(
    (contentType: ContentType, catalogId: string, replace = false) =>
      navigate((current) => browseRoute(contentType, catalogId, withoutTitle(current)), replace),
    [navigate],
  )

  const navigatePreset = useCallback(
    (contentType: ContentType, presetId: string, replace = false) =>
      navigate((current) => presetRoute(contentType, presetId, withoutTitle(current)), replace),
    [navigate],
  )

  const navigateSearch = useCallback(
    (contentType: ContentType, query: string, replace = false) => {
      navigate((current) => {
        const base = withoutTitle(current)
        if (!query.trim()) return browseRoute(contentType, base.catalogId, base)
        return searchRoute(contentType, query, base)
      }, replace)
    },
    [navigate],
  )

  const navigateToTitle = useCallback(
    (movie: Movie, season?: number | null, episode?: number | null, replace = false) =>
      navigate((current) => titleRoute(movie, current, season, episode), replace),
    [navigate],
  )

  const closeTitle = useCallback(() => navigate((current) => withoutTitle(current)), [navigate])

  return {
    route,
    routeUrl: appRouteToUrl(route),
    navigate,
    closeModal,
    openSettings,
    openDownloads,
    openFilters,
    openLegal,
    setSettingsTab,
    navigateBrowse,
    navigatePreset,
    navigateSearch,
    navigateToTitle,
    closeTitle,
  }
}

export type { AppRoute, AppRouteModal }
