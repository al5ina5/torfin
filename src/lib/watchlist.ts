import type { Movie } from '../types'
import { STORAGE_KEYS, loadStoredJson, saveStoredJson } from './storage'

export function loadWatchlist() {
  return loadStoredJson<Movie[]>(STORAGE_KEYS.watchlist, [])
}

function saveWatchlist(list: Movie[]) {
  saveStoredJson(STORAGE_KEYS.watchlist, list)
}

export function addToWatchlist(movie: Movie) {
  const list = loadWatchlist()
  if (list.some((entry) => entry.id === movie.id && entry.type === movie.type)) return list
  const next = [movie, ...list]
  saveWatchlist(next)
  return next
}

export function removeFromWatchlist(movie: Movie) {
  const next = loadWatchlist().filter((entry) => !(entry.id === movie.id && entry.type === movie.type))
  saveWatchlist(next)
  return next
}

export function toggleWatchlist(movie: Movie) {
  if (isInWatchlist(movie)) return removeFromWatchlist(movie)
  return addToWatchlist(movie)
}

export function isInWatchlist(movie: Movie) {
  return loadWatchlist().some((entry) => entry.id === movie.id && entry.type === movie.type)
}

export function mergeWatchlist(incoming: Movie[]) {
  const current = loadWatchlist()
  const next = [...current]
  for (const movie of incoming) {
    if (!next.some((entry) => entry.id === movie.id && entry.type === movie.type)) {
      next.push(movie)
    }
  }
  saveWatchlist(next)
  return next
}
