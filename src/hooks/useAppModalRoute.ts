import { useCallback, useEffect, useState } from 'react'

import { appRouteToUrl, readAppRoute, writeAppRoute, type AppModalRoute } from '../lib/app-routes'
import type { PreferencesTab } from '../types'

export function useAppModalRoute() {
  const [route, setRoute] = useState<AppModalRoute>(() => readAppRoute())

  useEffect(() => {
    const onPopState = () => setRoute(readAppRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: AppModalRoute, replace = false) => {
    writeAppRoute(next, replace)
    setRoute(next)
  }, [])

  const closeModal = useCallback(() => navigate({ kind: 'none' }), [navigate])

  const openSettings = useCallback(
    (tab: PreferencesTab = 'general', replace = false) => navigate({ kind: 'settings', tab }, replace),
    [navigate],
  )

  const openDownloads = useCallback(() => navigate({ kind: 'downloads' }), [navigate])
  const openFilters = useCallback(() => navigate({ kind: 'filters' }), [navigate])

  const setSettingsTab = useCallback(
    (tab: PreferencesTab) => navigate({ kind: 'settings', tab }, true),
    [navigate],
  )

  return {
    route,
    routeUrl: appRouteToUrl(route),
    navigate,
    closeModal,
    openSettings,
    openDownloads,
    openFilters,
    setSettingsTab,
  }
}
