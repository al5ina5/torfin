export const STORAGE_KEYS = {
  plugins: 'torfin.plugins',
  torboxApiKey: 'torfin.torboxApiKey',
  preferences: 'torfin.preferences',
  downloadConfig: 'torfin.downloadConfig',
  activeDownloadJob: 'torfin.activeDownloadJob',
  downloadJobs: 'torfin.downloadJobs',
  dismissedDownloadIds: 'torfin.dismissedDownloadIds',
  downloadSort: 'torfin.downloadSort',
  layout: 'torfin.layout',
  contentType: 'torfin.contentType',
  watchlist: 'torfin.watchlist',
  playbackProgress: 'torfin.playback-progress',
  theme: 'torfin.theme',
  recentViews: 'torfin.recent-views',
  searchHistory: 'torfin.search-history',
  filterPresets: 'torfin.filter-presets',
  lastCatalogId: 'torfin.last-catalog-id',
  legalNoticeAccepted: 'torfin.legal-notice-accepted',
  thirdPartyAddonAcks: 'torfin.third-party-addon-acks',
} as const

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadStoredString(key: string, fallback = '') {
  if (!hasLocalStorage()) return fallback
  try {
    const value = window.localStorage.getItem(key)
    return value ?? fallback
  } catch {
    return fallback
  }
}

export function loadStoredJson<T>(key: string, fallback: T) {
  if (!hasLocalStorage()) return fallback
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return fallback
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function saveStoredString(key: string, value: string) {
  if (!hasLocalStorage()) return
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    console.warn(`Failed to persist localStorage key "${key}"`, error)
  }
}

export function saveStoredJson(key: string, value: unknown) {
  if (!hasLocalStorage()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Failed to persist localStorage key "${key}"`, error)
  }
}
