import { useEffect } from 'react'

import type { Movie, StreamResult } from '../types'

type UseKeyboardShortcutsArgs = {
  modalOpen: boolean
  displayedMovies: Movie[]
  focusedMovieIndex: number
  setFocusedMovieIndex: (index: number) => void
  onSelectMovie: (movie: Movie) => void
  onFocusSearch: () => void
  onOpenSettings: () => void
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
  onSelectMovie,
  onFocusSearch,
  onOpenSettings,
  onPlayTopStream,
  onCloseModals,
  compactStreams,
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

      if (modalOpen || isEditableTarget(event.target)) return

      if (event.key === 'Enter' && compactStreams.length) {
        event.preventDefault()
        onPlayTopStream()
        return
      }

      if (!displayedMovies.length) return

      const columns = Math.max(1, Math.floor(window.innerWidth / 180))
      let next = focusedMovieIndex

      if (event.key === 'ArrowRight') next = Math.min(displayedMovies.length - 1, focusedMovieIndex + 1)
      else if (event.key === 'ArrowLeft') next = Math.max(0, focusedMovieIndex - 1)
      else if (event.key === 'ArrowDown') next = Math.min(displayedMovies.length - 1, focusedMovieIndex + columns)
      else if (event.key === 'ArrowUp') next = Math.max(0, focusedMovieIndex - columns)
      else return

      event.preventDefault()
      setFocusedMovieIndex(next)
      onSelectMovie(displayedMovies[next]!)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    compactStreams.length,
    displayedMovies,
    focusedMovieIndex,
    modalOpen,
    onCloseModals,
    onFocusSearch,
    onOpenSettings,
    onPlayTopStream,
    onSelectMovie,
    setFocusedMovieIndex,
  ])
}
