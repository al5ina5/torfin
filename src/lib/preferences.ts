import { loadThemeMode } from './theme'
import { STORAGE_KEYS, loadStoredJson, loadStoredString } from './storage'
import type { AppPreferences, ContentType, LibraryViewMode, StartupCatalogId } from '../types'

export const defaultPreferences: AppPreferences = {
  posterSize: 132,
  showRatings: true,
  showYears: true,
  defaultProfile: 'netflix',
  autoPlayResolvedStreams: true,
  preferCachedResults: true,
  customProfiles: [],
  autoPlayNextEpisode: true,
  downloadNotifications: true,
  theme: 'system',
  libraryViewMode: 'grid',
  defaultContentType: 'movie',
  defaultStartupCatalog: 'lastUsed',
  compactResultsLimit: 4,
  continueWatchingLimit: 40,
  recentViewsLimit: 30,
  searchHistoryEnabled: true,
  nextEpisodeCountdown: 0,
  expandStreamResultsByDefault: false,
  resumeMinSeconds: 30,
  completeRatioPercent: 92,
  alwaysConfirmDownloadDestination: false,
  jellyfinDuplicateAction: 'ask',
  apiRequestTimeoutSeconds: 15,
}

const startupCatalogIds: StartupCatalogId[] = [
  'lastUsed',
  'trending',
  'topRated',
  'featured',
  'newReleases',
  'watchlist',
  'continue',
  'recent',
]

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function normalizePreferences(stored: Partial<AppPreferences>): AppPreferences {
  const compactResultsLimit = clampNumber(Number(stored.compactResultsLimit) || defaultPreferences.compactResultsLimit, 3, 10)
  const continueWatchingLimit = clampNumber(Number(stored.continueWatchingLimit) || defaultPreferences.continueWatchingLimit, 10, 40)
  const recentViewsLimit = clampNumber(Number(stored.recentViewsLimit) || defaultPreferences.recentViewsLimit, 10, 30)
  const resumeMinSeconds = clampNumber(Number(stored.resumeMinSeconds ?? defaultPreferences.resumeMinSeconds), 0, 120)
  const completeRatioPercent = clampNumber(Number(stored.completeRatioPercent) || defaultPreferences.completeRatioPercent, 85, 95)
  const nextEpisodeCountdown = ([0, 5, 10, 15] as const).includes(stored.nextEpisodeCountdown as 0 | 5 | 10 | 15)
    ? (stored.nextEpisodeCountdown as AppPreferences['nextEpisodeCountdown'])
    : defaultPreferences.nextEpisodeCountdown
  const apiRequestTimeoutSeconds = ([10, 15, 30] as const).includes(stored.apiRequestTimeoutSeconds as 10 | 15 | 30)
    ? (stored.apiRequestTimeoutSeconds as AppPreferences['apiRequestTimeoutSeconds'])
    : defaultPreferences.apiRequestTimeoutSeconds
  const defaultStartupCatalog = startupCatalogIds.includes(stored.defaultStartupCatalog as StartupCatalogId)
    ? (stored.defaultStartupCatalog as StartupCatalogId)
    : defaultPreferences.defaultStartupCatalog
  const jellyfinDuplicateAction = stored.jellyfinDuplicateAction === 'allow' || stored.jellyfinDuplicateAction === 'block'
    ? stored.jellyfinDuplicateAction
    : 'ask'

  return {
    ...defaultPreferences,
    ...stored,
    customProfiles: stored.customProfiles ?? [],
    theme: stored.theme ?? loadThemeMode(),
    libraryViewMode: (stored.libraryViewMode === 'list' ? 'list' : 'grid') as LibraryViewMode,
    defaultContentType: stored.defaultContentType === 'series' ? 'series' : 'movie',
    defaultStartupCatalog,
    compactResultsLimit,
    continueWatchingLimit,
    recentViewsLimit,
    searchHistoryEnabled: stored.searchHistoryEnabled ?? defaultPreferences.searchHistoryEnabled,
    nextEpisodeCountdown,
    expandStreamResultsByDefault: stored.expandStreamResultsByDefault ?? defaultPreferences.expandStreamResultsByDefault,
    resumeMinSeconds,
    completeRatioPercent,
    alwaysConfirmDownloadDestination: stored.alwaysConfirmDownloadDestination ?? defaultPreferences.alwaysConfirmDownloadDestination,
    jellyfinDuplicateAction,
    apiRequestTimeoutSeconds,
  }
}

export function loadPreferences() {
  const stored = loadStoredJson<Partial<AppPreferences>>(STORAGE_KEYS.preferences, {})
  return normalizePreferences(stored)
}

export function resolveStartupCatalogId(preferences: AppPreferences) {
  if (preferences.defaultStartupCatalog === 'lastUsed') {
    return loadStoredString(STORAGE_KEYS.lastCatalogId, 'trending')
  }
  return preferences.defaultStartupCatalog
}

export function resolveStartupContentType(preferences: AppPreferences): ContentType {
  if (preferences.defaultStartupCatalog === 'lastUsed') {
    const stored = loadStoredString(STORAGE_KEYS.contentType, 'movie')
    return stored === 'series' ? 'series' : 'movie'
  }
  return preferences.defaultContentType
}
