import type { Movie } from '../types'
import { STORAGE_KEYS, loadStoredJson, saveStoredJson } from './storage'

export function loadRecentViews() {
  return loadStoredJson<Movie[]>(STORAGE_KEYS.recentViews, [])
}

export function recordRecentView(movie: Movie) {
  const key = `${movie.type}:${movie.id}`
  const next = [movie, ...loadRecentViews().filter((entry) => `${entry.type}:${entry.id}` !== key)].slice(0, 30)
  saveStoredJson(STORAGE_KEYS.recentViews, next)
  return next
}

export function loadSearchHistory() {
  return loadStoredJson<string[]>(STORAGE_KEYS.searchHistory, [])
}

export function recordSearchQuery(query: string) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return loadSearchHistory()
  const next = [trimmed, ...loadSearchHistory().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, 15)
  saveStoredJson(STORAGE_KEYS.searchHistory, next)
  return next
}

export function clearSearchHistory() {
  saveStoredJson(STORAGE_KEYS.searchHistory, [])
}
