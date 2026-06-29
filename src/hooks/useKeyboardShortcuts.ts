import { useEffect, type RefObject } from 'react'

import {
  resolveCatalogNavigationIndex,
  scrollCatalogItemIntoView,
  type CatalogNavigationDirection,
} from '../lib/catalog-grid-navigation'
import type { Movie, StreamResult } from '../types'

type UseKeyboardShortcutsArgs = {
  modalOpen: boolean
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
  onCloseModals: () => void
  compactStreams: StreamResult[]
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

export function useKeyboardShortcuts({
  modalOpen,
  displayedMovies,
  focusedMovieIndex,
  setFocusedMovieIndex,
  onFocusMovie,
  onSelectMovie,
  onFocusSearch,
  onOpenSettings,
  onOpenShortcuts,
  onPlayTopStream,
  onCloseModals,
  compactStreams,
  catalogScrollRef,
}: UseKeyboardShortcutsArgs) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        onFocusSearch()
        return
      }
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onFocusSearch()
        return
      }
      if (meta && event.key === ',') {
        event.preventDefault()
        onOpenSettings()
        return
      }
      if (event.key === 'Escape') {
        onCloseModals()
        return
      }
      if (event.key === '?' && !meta) {
        event.preventDefault()
        onOpenShortcuts()
        return
      }

      if (modalOpen || isEditableTarget(event.target)) return

      if (event.key === 'Enter') {
        if (compactStreams.length) {
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

      if (!displayedMovies.length) return

      const directionByKey: Record<string, CatalogNavigationDirection> = {
        ArrowRight: 'right',
        ArrowLeft: 'left',
        ArrowDown: 'down',
        ArrowUp: 'up',
      }
      const direction = directionByKey[event.key]
      if (!direction) return

      const currentIndex = focusedMovieIndex < 0 ? 0 : focusedMovieIndex
      const next = resolveCatalogNavigationIndex(
        catalogScrollRef.current,
        currentIndex,
        direction,
        displayedMovies.length,
      )
      if (next === currentIndex) return

      event.preventDefault()
      setFocusedMovieIndex(next)
      scrollCatalogItemIntoView(catalogScrollRef.current, next)
      onFocusMovie(displayedMovies[next]!)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    catalogScrollRef,
    compactStreams.length,
    displayedMovies,
    focusedMovieIndex,
    modalOpen,
    onCloseModals,
    onFocusMovie,
    onFocusSearch,
    onOpenSettings,
    onOpenShortcuts,
    onPlayTopStream,
    onSelectMovie,
    setFocusedMovieIndex,
  ])
}
