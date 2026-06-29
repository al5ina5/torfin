import { useEffect, useRef, type RefObject } from 'react'

import {
  activateKioskFocused,
  clearKioskFocus,
  directionByKey,
  findBlockingOverlayZone,
  findNearestCatalogIndex,
  focusFirstInZone,
  focusNearestInZone,
  getCatalogItemAnchorY,
  getKioskFocusAnchorY,
  getKioskFocused,
  isBodyOverlayActive,
  isCatalogAtHorizontalEdge,
  isEditableTarget,
  isInspectorZoneNavigable,
  navigateZoneFocus,
  setKioskFocus,
  tryDismissTopOverlay,
  type FocusZone,
  type NavigationDirection,
} from '../lib/focus-navigation'
import {
  resolveCatalogNavigationIndex,
  scrollCatalogItemIntoView,
} from '../lib/catalog-grid-navigation'
import type { Movie, StreamResult } from '../types'

export type UseAppFocusNavigationOptions = {
  enabled?: boolean
  isDesktop: boolean
  displayedMovies: Movie[]
  focusedMovieIndex: number
  setFocusedMovieIndex: (index: number) => void
  catalogScrollRef: RefObject<HTMLDivElement | null>
  onFocusMovie: (movie: Movie) => void
  onSelectMovie: (movie: Movie) => void
  onFocusSearch: () => void
  onOpenSettings: () => void
  onOpenShortcuts: () => void
  onPlayTopStream: () => void
  /** Fallback when DOM dismiss cannot find a close control. */
  onDismissOverlay?: () => void
  compactStreams: StreamResult[]
}

export function useAppFocusNavigation({
  enabled = true,
  isDesktop,
  displayedMovies,
  focusedMovieIndex,
  setFocusedMovieIndex,
  catalogScrollRef,
  onFocusMovie,
  onSelectMovie,
  onFocusSearch,
  onOpenSettings,
  onOpenShortcuts,
  onPlayTopStream,
  onDismissOverlay,
  compactStreams,
}: UseAppFocusNavigationOptions) {
  const activeZoneRef = useRef<FocusZone>('catalog')
  const lastOverlayRef = useRef<FocusZone | null>(null)

  useEffect(() => {
    if (!enabled) return

    const syncOverlayState = () => {
      const overlay = findBlockingOverlayZone(isDesktop)
      document.body.classList.toggle('modal-open', isBodyOverlayActive(isDesktop))

      if (overlay === lastOverlayRef.current) return
      lastOverlayRef.current = overlay

      if (overlay) {
        activeZoneRef.current = overlay
        clearKioskFocus()
        window.requestAnimationFrame(() => focusFirstInZone(overlay))
        return
      }

      if (activeZoneRef.current === 'modal') {
        activeZoneRef.current = 'catalog'
        clearKioskFocus()
      }
    }

    syncOverlayState()
    const observer = new MutationObserver(syncOverlayState)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'open', 'aria-hidden', 'aria-modal'],
    })

    return () => {
      observer.disconnect()
      document.body.classList.remove('modal-open')
    }
  }, [enabled, isDesktop])

  useEffect(() => {
    if (!enabled) return

    const focusNearestCatalogItem = (anchorY: number | null) => {
      if (anchorY === null || !displayedMovies.length) return
      const nearestIndex = findNearestCatalogIndex(catalogScrollRef.current, anchorY)
      if (nearestIndex === null) return
      setFocusedMovieIndex(nearestIndex)
      scrollCatalogItemIntoView(catalogScrollRef.current, nearestIndex)
      onFocusMovie(displayedMovies[nearestIndex]!)
    }

    const switchToZone = (zone: FocusZone, anchorY?: number | null) => {
      activeZoneRef.current = zone
      if (zone === 'catalog') {
        clearKioskFocus()
        focusNearestCatalogItem(anchorY ?? getKioskFocusAnchorY())
        return
      }

      const catalogAnchor =
        anchorY ??
        getCatalogItemAnchorY(
          catalogScrollRef.current,
          focusedMovieIndex < 0 ? 0 : focusedMovieIndex,
        )
      focusNearestInZone(zone, catalogAnchor)
    }

    const handleCatalogNavigation = (direction: NavigationDirection, event: KeyboardEvent) => {
      if (!displayedMovies.length) return false

      const currentIndex = focusedMovieIndex < 0 ? 0 : focusedMovieIndex
      const inspectorAvailable = isDesktop && isInspectorZoneNavigable()

      if (
        direction === 'left' &&
        isDesktop &&
        isCatalogAtHorizontalEdge(catalogScrollRef.current, currentIndex, 'left', displayedMovies.length)
      ) {
        event.preventDefault()
        switchToZone('sidebar')
        return true
      }

      if (
        direction === 'right' &&
        inspectorAvailable &&
        isCatalogAtHorizontalEdge(catalogScrollRef.current, currentIndex, 'right', displayedMovies.length)
      ) {
        event.preventDefault()
        switchToZone('inspector')
        return true
      }

      if (direction === 'up' && isDesktop && currentIndex === 0) {
        event.preventDefault()
        switchToZone('toolbar')
        return true
      }

      const next = resolveCatalogNavigationIndex(
        catalogScrollRef.current,
        currentIndex,
        direction,
        displayedMovies.length,
      )
      if (next === currentIndex) return false

      event.preventDefault()
      setFocusedMovieIndex(next)
      scrollCatalogItemIntoView(catalogScrollRef.current, next)
      onFocusMovie(displayedMovies[next]!)
      return true
    }

    const handleZoneNavigation = (zone: FocusZone, direction: NavigationDirection, event: KeyboardEvent) => {
      const current = getKioskFocused()
      const next = navigateZoneFocus(zone, direction, current)
      if (!next) {
        if (zone === 'sidebar' && direction === 'right') {
          event.preventDefault()
          switchToZone('catalog', getKioskFocusAnchorY())
          return true
        }
        if (zone === 'toolbar' && direction === 'down') {
          event.preventDefault()
          switchToZone('catalog', getKioskFocusAnchorY())
          return true
        }
        if (zone === 'inspector' && direction === 'left') {
          event.preventDefault()
          switchToZone('catalog', getKioskFocusAnchorY())
          return true
        }
        return false
      }

      event.preventDefault()
      setKioskFocus(next)
      return true
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        activeZoneRef.current = 'toolbar'
        onFocusSearch()
        return
      }
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        activeZoneRef.current = 'toolbar'
        onFocusSearch()
        return
      }
      if (meta && event.key === ',') {
        event.preventDefault()
        onOpenSettings()
        return
      }
      if (event.key === 'Escape') {
        if (!tryDismissTopOverlay(isDesktop)) {
          onDismissOverlay?.()
        }
        return
      }
      if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && !meta) {
        event.preventDefault()
        onOpenShortcuts()
        return
      }

      if (isEditableTarget(event.target)) return

      const direction = directionByKey[event.key as keyof typeof directionByKey] as NavigationDirection | undefined
      const overlayZone = findBlockingOverlayZone(isDesktop)
      const activeZone = overlayZone ?? activeZoneRef.current

      if (direction) {
        if (activeZone === 'catalog') {
          if (handleCatalogNavigation(direction, event)) return
        } else if (handleZoneNavigation(activeZone, direction, event)) {
          return
        }
      }

      if (event.key === 'Enter' || event.key === ' ') {
        if (activeZone !== 'catalog' && getKioskFocused()) {
          event.preventDefault()
          activateKioskFocused()
          return
        }

        if (activeZone === 'catalog' || activeZone === 'inspector') {
          if (compactStreams.length && activeZone === 'inspector') {
            event.preventDefault()
            onPlayTopStream()
            return
          }
          const focusedMovie = displayedMovies[focusedMovieIndex < 0 ? 0 : focusedMovieIndex]
          if (focusedMovie) {
            event.preventDefault()
            onSelectMovie(focusedMovie)
            return
          }
        }
      }

      if (event.key === 'Backspace' && activeZone !== 'catalog') {
        event.preventDefault()
        switchToZone('catalog')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    catalogScrollRef,
    compactStreams.length,
    displayedMovies,
    enabled,
    focusedMovieIndex,
    isDesktop,
    onDismissOverlay,
    onFocusMovie,
    onFocusSearch,
    onOpenSettings,
    onOpenShortcuts,
    onPlayTopStream,
    onSelectMovie,
    setFocusedMovieIndex,
  ])
}
