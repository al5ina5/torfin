import { useCallback, useEffect, useState } from 'react'

import {
  appRouteToUrl,
  browseRoute,
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

  const navigate = useCallback((next: AppRoute, replace = false) => {
    writeAppRoute(next, replace)
    setRoute(next)
  }, [])

  const closeModal = useCallback(() => navigate(withoutModal(route)), [navigate, route])

  const openSettings = useCallback(
    (tab: PreferencesTab = 'general', replace = false) =>
      navigate(withModal(route, { kind: 'settings', tab }), replace),
    [navigate, route],
  )

  const openDownloads = useCallback(() => navigate(withModal(route, { kind: 'downloads' })), [navigate, route])
  const openFilters = useCallback(() => navigate(withModal(route, { kind: 'filters' })), [navigate, route])

  const setSettingsTab = useCallback(
    (tab: PreferencesTab) => navigate(withModal(route, { kind: 'settings', tab }), true),
    [navigate, route],
  )

  const navigateBrowse = useCallback(
    (contentType: ContentType, catalogId: string, replace = false) =>
      navigate(browseRoute(contentType, catalogId, withoutTitle(route)), replace),
    [navigate, route],
  )

  const navigateSearch = useCallback(
    (contentType: ContentType, query: string, replace = false) => {
      if (!query.trim()) {
        navigate(browseRoute(contentType, route.catalogId, withoutTitle(route)), replace)
        return
      }
      navigate(searchRoute(contentType, query, withoutTitle(route)), replace)
    },
    [navigate, route],
  )

  const navigateToTitle = useCallback(
    (movie: Movie, season?: number | null, episode?: number | null, replace = false) =>
      navigate(titleRoute(movie, route, season, episode), replace),
    [navigate, route],
  )

  const closeTitle = useCallback(() => navigate(withoutTitle(route)), [navigate, route])

  return {
    route,
    routeUrl: appRouteToUrl(route),
    navigate,
    closeModal,
    openSettings,
    openDownloads,
    openFilters,
    setSettingsTab,
    navigateBrowse,
    navigateSearch,
    navigateToTitle,
    closeTitle,
  }
}

export type { AppRoute, AppRouteModal }
