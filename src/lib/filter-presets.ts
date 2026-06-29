import { defaultMovieFilters } from './movies'
import { STORAGE_KEYS, loadStoredJson, saveStoredJson } from './storage'
import type { FilterPreset, MovieFilters } from '../types'

export const FEATURED_PRESET_COUNT = 6

function preset(id: string, name: string, filters: Partial<MovieFilters>): FilterPreset {
  return {
    id: `builtin-${id}`,
    name,
    builtIn: true,
    filters: { ...defaultMovieFilters, ...filters },
  }
}

export const builtInFilterPresets: FilterPreset[] = [
  preset('90s-classics', '90s Classics', { yearFrom: '1990', yearTo: '1999', minRating: '7', sortBy: 'ratingDesc' }),
  preset('top-horror', 'Top Horror', { genre: 'Horror', minRating: '7', sortBy: 'ratingDesc' }),
  preset('recent-scifi', 'Recent Sci-Fi', { genre: 'Sci-Fi', yearFrom: '2015', sortBy: 'yearDesc' }),
  preset('family-friendly', 'Family Friendly', { genre: 'Family', minRating: '6', sortBy: 'ratingDesc' }),
  preset('80s-action', '80s Action', { genre: 'Action', yearFrom: '1980', yearTo: '1989', minRating: '6', sortBy: 'ratingDesc' }),
  preset('70s-cinema', '70s Cinema', { yearFrom: '1970', yearTo: '1979', minRating: '7', sortBy: 'ratingDesc' }),
  preset('2000s-hits', '2000s Hits', { yearFrom: '2000', yearTo: '2009', minRating: '7', sortBy: 'ratingDesc' }),
  preset('2010s-best', '2010s Best', { yearFrom: '2010', yearTo: '2019', minRating: '7', sortBy: 'ratingDesc' }),
  preset('new-this-decade', 'New This Decade', { yearFrom: '2020', sortBy: 'yearDesc' }),
  preset('golden-age', 'Golden Age', { yearFrom: '1950', yearTo: '1969', minRating: '7', sortBy: 'ratingDesc' }),
  preset('top-comedy', 'Top Comedy', { genre: 'Comedy', minRating: '7', sortBy: 'ratingDesc' }),
  preset('top-drama', 'Top Drama', { genre: 'Drama', minRating: '7', sortBy: 'ratingDesc' }),
  preset('top-thriller', 'Top Thriller', { genre: 'Thriller', minRating: '7', sortBy: 'ratingDesc' }),
  preset('top-romance', 'Top Romance', { genre: 'Romance', minRating: '7', sortBy: 'ratingDesc' }),
  preset('top-animation', 'Top Animation', { genre: 'Animation', minRating: '7', sortBy: 'ratingDesc' }),
  preset('top-documentary', 'Top Documentary', { genre: 'Documentary', minRating: '7', sortBy: 'ratingDesc' }),
  preset('crime-epics', 'Crime Epics', { genre: 'Crime', minRating: '7', sortBy: 'ratingDesc' }),
  preset('war-stories', 'War Stories', { genre: 'War', minRating: '6', sortBy: 'ratingDesc' }),
  preset('fantasy-worlds', 'Fantasy Worlds', { genre: 'Fantasy', minRating: '6', sortBy: 'ratingDesc' }),
  preset('mystery-nights', 'Mystery Nights', { genre: 'Mystery', minRating: '6', sortBy: 'ratingDesc' }),
  preset('western-classics', 'Western Classics', { genre: 'Western', minRating: '6', sortBy: 'ratingDesc' }),
  preset('musical-magic', 'Musical Magic', { genre: 'Musical', minRating: '6', sortBy: 'ratingDesc' }),
  preset('biography-picks', 'Biography Picks', { genre: 'Biography', minRating: '7', sortBy: 'ratingDesc' }),
  preset('film-noir', 'Film Noir', { genre: 'Film-Noir', sortBy: 'ratingDesc' }),
  preset('adventure-quests', 'Adventure Quests', { genre: 'Adventure', minRating: '6', sortBy: 'ratingDesc' }),
  preset('sports-stories', 'Sports Stories', { genre: 'Sport', minRating: '6', sortBy: 'ratingDesc' }),
  preset('mind-bending-scifi', 'Mind-Bending Sci-Fi', { genre: 'Sci-Fi', minRating: '8', sortBy: 'ratingDesc' }),
  preset('creepy-horror', 'Creepy Horror', { genre: 'Horror', minRating: '8', sortBy: 'ratingDesc' }),
  preset('feel-good-comedy', 'Feel-Good Comedy', { genre: 'Comedy', minRating: '6', sortBy: 'ratingDesc' }),
  preset('award-season', 'Award Season', { genre: 'Drama', minRating: '8', sortBy: 'ratingDesc' }),
  preset('date-night', 'Date Night', { genre: 'Romance', minRating: '7', yearFrom: '1990', sortBy: 'ratingDesc' }),
  preset('late-night-thrills', 'Late Night Thrills', { genre: 'Thriller', minRating: '7', sortBy: 'ratingDesc' }),
  preset('kids-and-family', 'Kids & Family', { genre: 'Family', minRating: '6', sortBy: 'ratingDesc' }),
  preset('animated-gems', 'Animated Gems', { genre: 'Animation', minRating: '8', sortBy: 'ratingDesc' }),
  preset('cult-classics', 'Cult Classics', { yearFrom: '1975', yearTo: '1989', minRating: '7', sortBy: 'ratingDesc' }),
  preset('modern-masterpieces', 'Modern Masterpieces', { yearFrom: '2015', minRating: '8', sortBy: 'ratingDesc' }),
  preset('hidden-gems', 'Hidden Gems', { minRating: '6', sortBy: 'ratingDesc' }),
  preset('critically-acclaimed', 'Critically Acclaimed', { minRating: '8', sortBy: 'ratingDesc' }),
  preset('true-stories', 'True Stories', { genre: 'Biography', minRating: '7', sortBy: 'yearDesc' }),
  preset('history-lessons', 'History Lessons', { genre: 'History', minRating: '7', sortBy: 'ratingDesc' }),
  preset('spooky-season', 'Spooky Season', { genre: 'Horror', minRating: '6', sortBy: 'ratingDesc' }),
  preset('summer-blockbusters', 'Summer Blockbusters', { genre: 'Action', yearFrom: '2000', yearTo: '2020', minRating: '6', sortBy: 'ratingDesc' }),
  preset('cozy-night-in', 'Cozy Night In', { genre: 'Comedy', minRating: '6', yearFrom: '1990', sortBy: 'ratingDesc' }),
  preset('edge-of-seat', 'Edge of Seat', { genre: 'Thriller', minRating: '8', sortBy: 'ratingDesc' }),
  preset('recent-horror', 'Recent Horror', { genre: 'Horror', yearFrom: '2018', sortBy: 'yearDesc' }),
  preset('recent-comedy', 'Recent Comedy', { genre: 'Comedy', yearFrom: '2018', sortBy: 'yearDesc' }),
  preset('recent-drama', 'Recent Drama', { genre: 'Drama', yearFrom: '2018', sortBy: 'yearDesc' }),
  preset('classic-comedy', 'Classic Comedy', { genre: 'Comedy', yearTo: '1989', minRating: '7', sortBy: 'ratingDesc' }),
  preset('classic-thriller', 'Classic Thriller', { genre: 'Thriller', yearTo: '1999', minRating: '7', sortBy: 'ratingDesc' }),
  preset('indie-vibes', 'Indie Vibes', { genre: 'Drama', minRating: '7', yearFrom: '2000', sortBy: 'yearDesc' }),
  preset('epic-fantasy', 'Epic Fantasy', { genre: 'Fantasy', minRating: '7', sortBy: 'ratingDesc' }),
]

export function pickFeaturedPresets(
  presets: FilterPreset[],
  count = FEATURED_PRESET_COUNT,
): FilterPreset[] {
  const copy = [...presets]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

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
