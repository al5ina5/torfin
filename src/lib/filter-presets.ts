import { defaultMovieFilters } from './movies'
import { STORAGE_KEYS, loadStoredJson, saveStoredJson } from './storage'
import type { FilterPreset, MovieFilters } from '../types'

export const builtInFilterPresets: FilterPreset[] = [
  {
    id: 'builtin-90s-classics',
    name: '90s Classics',
    builtIn: true,
    filters: { ...defaultMovieFilters, yearFrom: '1990', yearTo: '1999', minRating: '7', sortBy: 'ratingDesc' },
  },
  {
    id: 'builtin-top-horror',
    name: 'Top Horror',
    builtIn: true,
    filters: { ...defaultMovieFilters, genre: 'Horror', minRating: '7', sortBy: 'ratingDesc' },
  },
  {
    id: 'builtin-recent-scifi',
    name: 'Recent Sci-Fi',
    builtIn: true,
    filters: { ...defaultMovieFilters, genre: 'Sci-Fi', yearFrom: '2015', sortBy: 'yearDesc' },
  },
  {
    id: 'builtin-family-friendly',
    name: 'Family Friendly',
    builtIn: true,
    filters: { ...defaultMovieFilters, genre: 'Family', minRating: '6', sortBy: 'ratingDesc' },
  },
]

export function loadCustomFilterPresets() {
  return loadStoredJson<FilterPreset[]>(STORAGE_KEYS.filterPresets, [])
}

export function saveCustomFilterPresets(presets: FilterPreset[]) {
  saveStoredJson(
    STORAGE_KEYS.filterPresets,
    presets.filter((preset) => !preset.builtIn),
  )
}

export function allFilterPresets() {
  return [...builtInFilterPresets, ...loadCustomFilterPresets()]
}

export function createFilterPreset(name: string, filters: MovieFilters): FilterPreset {
  return {
    id: `custom-${Date.now()}`,
    name: name.trim() || 'Custom preset',
    builtIn: false,
    filters: { ...filters },
  }
}
