import { LayoutGrid, List, Menu, Search, SlidersHorizontal } from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'

import { ConfirmationDialog } from './components/ConfirmationDialog'
import { DownloadDestinationPicker } from './components/DownloadDestinationPicker'
import { DownloadsModal } from './components/DownloadsModal'
import { FiltersModal } from './components/FiltersModal'
import { InspectorPanel } from './components/InspectorPanel'
import { JellyfinSignInModal } from './components/JellyfinSignInModal'
import { MovieGrid } from './components/MovieGrid'
import { MovieList } from './components/MovieList'
import { PreferencesModal } from './components/PreferencesModal'
import { Sidebar } from './components/Sidebar'
import { useAppModalRoute } from './hooks/useAppModalRoute'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useDockBadge } from './hooks/useDockBadge'
import { useDownloadNotifications } from './hooks/useDownloadNotifications'
import { loadServerDownloads, useDownloadPolling } from './hooks/useDownloadPolling'
import { useJellyfinRefresh } from './hooks/useJellyfinRefresh'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useSecrets } from './hooks/useSecrets'
import { getApi, isTauriRuntime, loadJson, postApi, resolveStreamUrl } from './lib/api'
import { catalogPageUrl, enrichMovieFromMeta, metaUrl, normalizeCatalogItem, normalizeSeriesEpisodes, similarMoviesFromMeta, searchUrl } from './lib/cinemeta'
import { allProfileOptions, builtinProfileList, findCustomProfile } from './lib/custom-profiles'
import { allFilterPresets, createFilterPreset, loadCustomFilterPresets, saveCustomFilterPresets } from './lib/filter-presets'
import {
  destinationToLegacyConfig,
  getDefaultDestination,
  getDestination,
  loadDestinationSecrets,
  migrateDownloadConfig,
  migrateLegacySecrets,
  readyDestinations,
  shouldPromptDestinationPicker,
  syncLocalDestinationWithServer,
} from './lib/download-destinations'
import {
  buildPollConfig,
  defaultDownloadConfig,
  dedupeDownloadJobs,
  downloadSidebarSummary,
  localPayload,
  makeDownloadFilename,
  makeMovieFolderName,
  mergeServerDownloadJobs,
  qbittorrentPayload,
  withDownloadTimestamp,
} from './lib/downloads'
import { appendUniqueMovies, catalogOptions, catalogUrlMap, catalogUrlWithFilters, defaultMovieFilters, effectiveMovieFilters, filterAndSortMovies, isLibraryCatalog, libraryCatalogOptions } from './lib/movies'
import { clearSearchHistory, loadRecentViews, loadSearchHistory, recordRecentView, recordSearchQuery } from './lib/history'
import { hydrateUrl, loadSavedPlugins, pluginNeedsTorboxKey } from './lib/plugins'
import { buildSettingsExport, downloadSettingsFile, parseSettingsExport } from './lib/settings-export'
import { applyThemeMode, loadThemeMode, saveThemeMode } from './lib/theme'
import { getPlaybackResumePosition, nextEpisode, savePlaybackPosition, continueWatchingMovies } from './lib/playback-progress'
import { inspectMedia, needsTranscodeFallback, playbackUnavailableMessage, shouldTranscodeDirectly, startHlsTranscode } from './lib/playback'
import { jellyfinPlayUrl, lookupJellyfinLibrary, streamTargetQuality } from './lib/jellyfin-library'
import { filterStreamsForProfile, normalizeStreams } from './lib/streams'
import { STORAGE_KEYS, loadStoredJson, loadStoredString, saveStoredJson, saveStoredString } from './lib/storage'
import { isInWatchlist, loadWatchlist, toggleWatchlist } from './lib/watchlist'
import type {
  AppPreferences,
  ContentType,
  DownloadConfig,
  DownloadDestination,
  DownloadJob,
  DownloadSort,
  FilterPreset,
  JellyfinLibraryMatch,
  LibraryViewMode,
  MediaInfo,
  Movie,
  PluginConfig,
  PreferencesTab,
  ResultProfile,
  StreamResult,
} from './types'

const catalogPageSize = 100
const compactResultsLimit = 4
const defaultPreferences: AppPreferences = {
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
}

function loadPreferences() {
  const stored = loadStoredJson<Partial<AppPreferences>>(STORAGE_KEYS.preferences, {})
  return {
    ...defaultPreferences,
    ...stored,
    customProfiles: stored.customProfiles ?? [],
    theme: stored.theme ?? loadThemeMode(),
    libraryViewMode: (stored.libraryViewMode === 'list' ? 'list' : 'grid') as LibraryViewMode,
  }
}

const resultProfiles = builtinProfileList()

const defaultLayout = { leftSidebarWidth: 220, rightSidebarWidth: 520 }
const layoutLimits = {
  leftMin: 164,
  leftMax: 340,
  rightMin: 390,
  rightMax: 760,
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function loadSavedLayout() {
  const parsed = loadStoredJson<Partial<typeof defaultLayout>>(STORAGE_KEYS.layout, {})
  return {
    leftSidebarWidth: clampNumber(
      Number(parsed.leftSidebarWidth) || defaultLayout.leftSidebarWidth,
      layoutLimits.leftMin,
      layoutLimits.leftMax,
    ),
    rightSidebarWidth: clampNumber(
      Number(parsed.rightSidebarWidth) || defaultLayout.rightSidebarWidth,
      layoutLimits.rightMin,
      layoutLimits.rightMax,
    ),
  }
}

function loadContentType(): ContentType {
  const stored = loadStoredString(STORAGE_KEYS.contentType, 'movie')
  return stored === 'series' ? 'series' : 'movie'
}

function loadDownloadConfig() {
  const stored = loadStoredJson(STORAGE_KEYS.downloadConfig, defaultDownloadConfig)
  return migrateDownloadConfig(stored, isTauriRuntime())
}

export default function App() {
  const tauri = isTauriRuntime()
  const [contentType, setContentType] = useState<ContentType>(loadContentType)
  const [catalogId, setCatalogId] = useState<string>(catalogOptions[0]?.id ?? 'trending')
  const [query, setQuery] = useState('')
  const [movies, setMovies] = useState<Movie[]>([])
  const [catalogSkip, setCatalogSkip] = useState(0)
  const [hasMoreMovies, setHasMoreMovies] = useState(true)
  const [loadingMoreMovies, setLoadingMoreMovies] = useState(false)
  const [movieFilters, setMovieFilters] = useState(defaultMovieFilters)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null)
  const [plugins, setPlugins] = useState<PluginConfig[]>(loadSavedPlugins)
  const [preferences, setPreferences] = useState(loadPreferences)
  const [watchlist, setWatchlist] = useState<Movie[]>(loadWatchlist)
  const [recentViews, setRecentViews] = useState<Movie[]>(loadRecentViews)
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory)
  const [customFilterPresets, setCustomFilterPresets] = useState(() => loadCustomFilterPresets())
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false)
  const [downloadConfig, setDownloadConfig] = useState<DownloadConfig>(loadDownloadConfig)
  const [destinationSecretMap, setDestinationSecretMap] = useState<Record<string, { jellyfinApiKey: string; sshPassword: string }>>({})
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false)
  const [pendingDownload, setPendingDownload] = useState<{ stream: StreamResult; index: number } | null>(null)
  const [torboxKeyPromptOpen, setTorboxKeyPromptOpen] = useState(false)
  const [jellyfinSignInBaseUrl, setJellyfinSignInBaseUrl] = useState('')
  const [jellyfinSignInCallback, setJellyfinSignInCallback] = useState<((token: string) => void) | null>(null)
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>(dedupeDownloadJobs(loadStoredJson<DownloadJob[]>(STORAGE_KEYS.downloadJobs, []).map(withDownloadTimestamp)))
  const [downloadSort, setDownloadSort] = useState<DownloadSort>(loadStoredJson<DownloadSort>(STORAGE_KEYS.downloadSort, 'newest'))
  const [downloadSortOpen, setDownloadSortOpen] = useState(false)
  const [resultProfile, setResultProfile] = useState<ResultProfile>(preferences.defaultProfile)
  const [resultsExpanded, setResultsExpanded] = useState(false)
  const [streams, setStreams] = useState<StreamResult[]>([])
  const [streamErrors, setStreamErrors] = useState<string[]>([])
  const [resolvingStreamKey, setResolvingStreamKey] = useState('')
  const [downloadingStreamKey, setDownloadingStreamKey] = useState('')
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [currentSourceUrl, setCurrentSourceUrl] = useState('')
  const [playbackTitle, setPlaybackTitle] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [playbackStatus, setPlaybackStatus] = useState('')
  const [playbackStartAt, setPlaybackStartAt] = useState<number | null>(null)
  const [focusedMovieIndex, setFocusedMovieIndex] = useState(0)
  const [batchDownloading, setBatchDownloading] = useState(false)
  const [enrichedMovie, setEnrichedMovie] = useState<Movie | null>(null)
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([])
  const [jellyfinMatch, setJellyfinMatch] = useState<JellyfinLibraryMatch | null>(null)
  const [jellyfinLoading, setJellyfinLoading] = useState(false)
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | null>(null)
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [downloadsOpen, setDownloadsOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [preferencesTab, setPreferencesTab] = useState<PreferencesTab>('general')
  const [jellyfinSignInOpen, setJellyfinSignInOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<DownloadJob | null>(null)
  const [layout, setLayout] = useState(loadSavedLayout)
  const [movieError, setMovieError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const pendingAutoPlayRef = useRef(false)

  const { torboxApiKey, jellyfinApiKey, sshPassword, loaded: secretsLoaded, setTorboxApiKey, setJellyfinApiKey } = useSecrets()
  const { route, closeModal, openSettings, openDownloads, openFilters, setSettingsTab } = useAppModalRoute()
  const debouncedQuery = useDebouncedValue(query, 300).trim()
  const shouldRemoteSearch = debouncedQuery.length >= 2
  const selectedCatalog = [...libraryCatalogOptions, ...catalogOptions].find((item) => item.id === catalogId) ?? catalogOptions[0]
  const baseCatalogUrl = isLibraryCatalog(catalogId) ? '' : catalogUrlMap(contentType)[selectedCatalog.id as keyof ReturnType<typeof catalogUrlMap>]
  const filteredCatalogUrl = baseCatalogUrl
    ? catalogUrlWithFilters(baseCatalogUrl || catalogUrlMap(contentType).trending, movieFilters, contentType)
    : ''
  const contentLabelPlural = contentType === 'series' ? 'Shows' : 'Movies'
  const contentLabelSingular = contentType === 'series' ? 'Show' : 'Movie'
  const activePlugins = useMemo(() => plugins.filter((plugin) => plugin.enabled && plugin.streamUrlTemplate.trim() && (!pluginNeedsTorboxKey(plugin) || torboxApiKey.trim())), [plugins, torboxApiKey])
  const activePluginCount = plugins.filter((plugin) => plugin.enabled).length
  const shellStyle = {
    '--left-sidebar-width': `${layout.leftSidebarWidth}px`,
    '--right-sidebar-width': `${layout.rightSidebarWidth}px`,
  } as CSSProperties

  const profileOptions = useMemo(() => allProfileOptions(preferences), [preferences])
  const downloadSummary = useMemo(() => downloadSidebarSummary(downloadJobs), [downloadJobs])
  const activeCustomProfile = useMemo(() => findCustomProfile(preferences, resultProfile), [preferences, resultProfile])
  const inspectorMovie = enrichedMovie ?? selectedMovie
  const watchlistIds = useMemo(() => new Set(watchlist.map((movie) => `${movie.type}:${movie.id}`)), [watchlist])
  const filterPresets = useMemo(() => allFilterPresets(), [customFilterPresets])

  const { data: catalogData, error: catalogError, isLoading: catalogLoading } = useSWR(
    isLibraryCatalog(catalogId) ? null : ['catalog', contentType, filteredCatalogUrl],
    ([, type, url]) => loadJson<{ metas?: unknown[] }>(catalogPageUrl(url, 0)).then((body) => (body.metas || []).map((item) => normalizeCatalogItem(item as never, type as ContentType)).filter(Boolean) as Movie[]),
  )
  const { data: searchData, error: searchError, isLoading: searchLoading } = useSWR(shouldRemoteSearch ? ['search', contentType, debouncedQuery] : null, ([, type, value]) => loadJson<{ metas?: unknown[] }>(searchUrl(value, type as ContentType)).then((body) => (body.metas || []).map((item) => normalizeCatalogItem(item as never, type as ContentType)).filter(Boolean) as Movie[]))
  const { data: seriesEpisodes, error: seriesMetaError, isLoading: seriesMetaLoading } = useSWR(
    selectedMovie?.type === 'series' ? ['series-meta', selectedMovie.id] : null,
    () => loadJson<{ meta?: { videos?: unknown[] } }>(metaUrl('series', selectedMovie!.id)).then((body) => normalizeSeriesEpisodes(body)),
  )
  const episodeSelection = useMemo(() => {
    if (selectedMovie?.type !== 'series' || selectedSeason === null || selectedEpisode === null) return undefined
    return { season: selectedSeason, episode: selectedEpisode }
  }, [selectedEpisode, selectedMovie?.type, selectedSeason])
  const { data: streamData, error: streamError, isLoading: streamsLoading, mutate: refreshStreams } = useSWR(
    selectedMovie && (selectedMovie.type === 'movie' || episodeSelection)
      ? ['streams', selectedMovie.id, contentType, episodeSelection?.season, episodeSelection?.episode, torboxApiKey.trim(), activePlugins.map((plugin) => `${plugin.id}:${plugin.streamUrlTemplate}`).join('|')]
      : null,
    async () => {
    if (!selectedMovie) return { streams: [] as StreamResult[], errors: [] as string[] }
    const settled = await Promise.allSettled(activePlugins.map(async (plugin) => {
      const url = hydrateUrl(plugin.streamUrlTemplate, selectedMovie, torboxApiKey, contentType, episodeSelection)
      return normalizeStreams(plugin.name, await loadJson<unknown>(url))
    }))
    const found: StreamResult[] = []
    const errors: string[] = []
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') found.push(...result.value)
      else errors.push(`${activePlugins[index]?.name || 'Plugin'}: ${String(result.reason)}`)
    })
    return { streams: found.sort((a, b) => b.rank - a.rank), errors }
  })
  const { data: serverStatuses } = useSWR(tauri ? null : '/api/downloads', loadServerDownloads, { refreshInterval: 1000 })
  const { data: serverHealth } = useSWR(tauri ? null : '/api/health', () => getApi<{ downloadDir: string }>('/api/health'), { revalidateOnFocus: false })

  useEffect(() => {
    if (!serverHealth?.downloadDir || tauri) return
    setDownloadConfig((current) => {
      const next = syncLocalDestinationWithServer(current, serverHealth.downloadDir)
      return next === current ? current : next
    })
  }, [serverHealth?.downloadDir, tauri])

  const activeDestination = useMemo(() => getDestination(downloadConfig), [downloadConfig])
  const jellyfinDestination = useMemo(
    () =>
      downloadConfig.destinations.find((entry) => entry.kind === 'remote-jellyfin' && entry.jellyfinUrl.trim())
      ?? downloadConfig.destinations.find((entry) => entry.jellyfinUrl.trim())
      ?? activeDestination,
    [activeDestination, downloadConfig.destinations],
  )
  const activeSecrets = activeDestination ? destinationSecretMap[activeDestination.id] : undefined
  const jellyfinSecrets = jellyfinDestination ? destinationSecretMap[jellyfinDestination.id] : undefined

  const effectiveDownloadConfig = useMemo(
    () => {
      if (!activeDestination) {
        return {
          ...downloadConfig,
          sshPassword: sshPassword || downloadConfig.sshPassword,
          jellyfinApiKey: jellyfinApiKey || downloadConfig.jellyfinApiKey,
        }
      }
      const secrets = {
        jellyfinApiKey: activeSecrets?.jellyfinApiKey || jellyfinApiKey || downloadConfig.jellyfinApiKey,
        sshPassword: activeSecrets?.sshPassword || sshPassword || downloadConfig.sshPassword,
      }
      return destinationToLegacyConfig(downloadConfig, activeDestination, secrets)
    },
    [activeDestination, activeSecrets, downloadConfig, jellyfinApiKey, sshPassword],
  )

  useDownloadPolling({ enabled: tauri, downloadJobs, setDownloadJobs })
  useJellyfinRefresh({ downloadJobs, setDownloadJobs })
  useDownloadNotifications({ enabled: preferences.downloadNotifications, jobs: downloadJobs })
  useDockBadge(downloadJobs)

  useEffect(() => {
    switch (route.kind) {
      case 'settings':
        setPreferencesTab(route.tab)
        setPreferencesOpen(true)
        setDownloadsOpen(false)
        setFiltersOpen(false)
        break
      case 'downloads':
        setDownloadsOpen(true)
        setPreferencesOpen(false)
        setFiltersOpen(false)
        break
      case 'filters':
        setFiltersOpen(true)
        setPreferencesOpen(false)
        setDownloadsOpen(false)
        break
      case 'none':
        setPreferencesOpen(false)
        setDownloadsOpen(false)
        setFiltersOpen(false)
        break
    }
  }, [route])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        downloadConfig.destinations.map(async (destination) => [destination.id, await loadDestinationSecrets(destination)] as const),
      )
      if (!cancelled) setDestinationSecretMap(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [downloadConfig.destinations])

  useEffect(() => {
    if (!secretsLoaded || !downloadConfig.destinations.length) return
    void migrateLegacySecrets(downloadConfig, { jellyfinApiKey, sshPassword })
  }, [downloadConfig.destinations.length, jellyfinApiKey, secretsLoaded, sshPassword])

  useEffect(() => {
    applyThemeMode(preferences.theme)
    saveThemeMode(preferences.theme)
  }, [preferences.theme])

  useEffect(() => {
    if (isLibraryCatalog(catalogId)) {
      setSelectedMovie(null)
      setMovieError('')
      setCatalogSkip(0)
      setHasMoreMovies(false)
      return
    }

    setSelectedMovie(null)
    setSelectedSeason(null)
    setSelectedEpisode(null)
    setMovieError('')

    if (catalogData) {
      setMovies(catalogData)
      setCatalogSkip(catalogPageSize)
      setHasMoreMovies(catalogData.length > 0)
    } else {
      setMovies([])
      setCatalogSkip(0)
      setHasMoreMovies(true)
    }
  }, [catalogData, catalogId, contentType, filteredCatalogUrl])

  useEffect(() => {
    if (!isLibraryCatalog(catalogId)) return
    setMovieError('')
    if (catalogId === 'watchlist') {
      setMovies(watchlist.filter((movie) => movie.type === contentType))
    } else if (catalogId === 'recent') {
      setMovies(recentViews.filter((movie) => movie.type === contentType))
    } else {
      setMovies(continueWatchingMovies().filter((movie) => movie.type === contentType))
    }
    setCatalogSkip(0)
    setHasMoreMovies(false)
  }, [catalogId, contentType, recentViews, watchlist])
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setSearchHistory(recordSearchQuery(debouncedQuery))
    }
  }, [debouncedQuery])
  useEffect(() => { setStreams(streamData?.streams || []); setStreamErrors([...(streamData?.errors || []), ...(streamError ? [streamError instanceof Error ? streamError.message : 'Stream lookup failed'] : [])]) }, [streamData, streamError])
  useEffect(() => { if (serverStatuses) setDownloadJobs((current) => mergeServerDownloadJobs(current, serverStatuses)) }, [serverStatuses])
  useEffect(() => { saveStoredJson(STORAGE_KEYS.plugins, plugins); saveStoredJson(STORAGE_KEYS.preferences, preferences); saveStoredJson(STORAGE_KEYS.downloadConfig, downloadConfig); saveStoredJson(STORAGE_KEYS.downloadJobs, downloadJobs); saveStoredJson(STORAGE_KEYS.downloadSort, downloadSort); saveStoredJson(STORAGE_KEYS.layout, layout) }, [downloadConfig, downloadJobs, downloadSort, layout, plugins, preferences])
  useEffect(() => { saveStoredString(STORAGE_KEYS.contentType, contentType) }, [contentType])
  useEffect(() => {
    if (selectedMovie?.type !== 'series') {
      setSelectedSeason(null)
      setSelectedEpisode(null)
      return
    }
    if (!seriesEpisodes?.length) return
    const first = seriesEpisodes.find((entry) => entry.season >= 1) ?? seriesEpisodes[0]
    setSelectedSeason(first.season)
    setSelectedEpisode(first.episode)
  }, [selectedMovie?.id, selectedMovie?.type, seriesEpisodes])
  useEffect(() => { setResultProfile(preferences.defaultProfile) }, [preferences.defaultProfile])
  useEffect(() => { setResultsExpanded(false) }, [resultProfile, selectedMovie?.id, selectedSeason, selectedEpisode])

  useEffect(() => {
    if (!selectedMovie) {
      setEnrichedMovie(null)
      setSimilarMovies([])
      setJellyfinMatch(null)
      return
    }
    let cancelled = false
    void loadJson<Record<string, unknown>>(metaUrl(selectedMovie.type, selectedMovie.id)).then((body) => {
      if (cancelled) return
      setEnrichedMovie(enrichMovieFromMeta(selectedMovie, body))
      setSimilarMovies(similarMoviesFromMeta(body, selectedMovie.type))
    })
    return () => {
      cancelled = true
    }
  }, [selectedMovie])

  useEffect(() => {
    const jellyfinUrl = jellyfinDestination?.jellyfinUrl || effectiveDownloadConfig.jellyfinUrl
    const jellyfinApiKeyValue =
      jellyfinSecrets?.jellyfinApiKey || activeSecrets?.jellyfinApiKey || jellyfinApiKey || effectiveDownloadConfig.jellyfinApiKey
    if (!selectedMovie || !jellyfinUrl.trim() || !jellyfinApiKeyValue.trim()) {
      setJellyfinMatch(null)
      return
    }
    let cancelled = false
    setJellyfinLoading(true)
    void lookupJellyfinLibrary({
      baseUrl: jellyfinUrl,
      apiKey: jellyfinApiKeyValue,
      imdbId: selectedMovie.id,
      contentType: selectedMovie.type,
      season: episodeSelection?.season,
      episode: episodeSelection?.episode,
    })
      .then((match) => {
        if (!cancelled) setJellyfinMatch(match)
      })
      .finally(() => {
        if (!cancelled) setJellyfinLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    activeSecrets?.jellyfinApiKey,
    effectiveDownloadConfig.jellyfinApiKey,
    effectiveDownloadConfig.jellyfinUrl,
    episodeSelection?.episode,
    episodeSelection?.season,
    jellyfinApiKey,
    jellyfinDestination?.jellyfinUrl,
    jellyfinSecrets?.jellyfinApiKey,
    selectedMovie,
  ])

  useEffect(() => {
    const modalOpen = filtersOpen || downloadsOpen || preferencesOpen || jellyfinSignInOpen || torboxKeyPromptOpen || Boolean(confirmRemove)
    const mobileOverlayOpen = !isDesktop && (sidebarOpen || Boolean(selectedMovie))
    document.body.classList.toggle('modal-open', modalOpen || mobileOverlayOpen)
    return () => document.body.classList.remove('modal-open')
  }, [confirmRemove, downloadsOpen, filtersOpen, isDesktop, jellyfinSignInOpen, preferencesOpen, selectedMovie, sidebarOpen, torboxKeyPromptOpen])

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false)
  }, [isDesktop])

  const displayedMovies = useMemo(() => {
    const local = query.trim() ? movies.filter((movie) => `${movie.name} ${movie.releaseInfo || ''}`.toLowerCase().includes(query.trim().toLowerCase())) : movies
    const filters = effectiveMovieFilters(catalogId, movieFilters)
    return filterAndSortMovies(shouldRemoteSearch ? (searchData || []) : local, filters)
  }, [catalogId, movies, movieFilters, query, searchData, shouldRemoteSearch])
  const compactStreams = useMemo(() => {
    const filtered = filterStreamsForProfile(streams, resultProfile, preferences.preferCachedResults, activeCustomProfile)
    return filtered.length ? filtered.slice(0, compactResultsLimit) : streams.slice(0, compactResultsLimit)
  }, [activeCustomProfile, preferences.preferCachedResults, resultProfile, streams])

  const topStreamQuality = compactStreams[0] ? streamTargetQuality(compactStreams[0]) : 0
  const jellyfinItemUrl = jellyfinMatch ? jellyfinPlayUrl(effectiveDownloadConfig.jellyfinUrl, jellyfinMatch.itemId) : ''

  const moviesLoading = !isLibraryCatalog(catalogId) && (catalogLoading || (!catalogError && !catalogData && !movies.length))
  const movieErrorMessage = movieError || (catalogError instanceof Error ? catalogError.message : catalogError ? `Could not load ${contentLabelPlural.toLowerCase()}` : '')
  const searchErrorMessage = searchError instanceof Error ? searchError.message : searchError ? 'Search failed' : ''
  const streamEmptyMessage = activePlugins.length === 0
    ? plugins.some((plugin) => plugin.enabled && pluginNeedsTorboxKey(plugin) && !torboxApiKey.trim())
      ? 'Enabled sources need a Torbox API key before they can return results. Add it in Settings, then refresh.'
      : 'No stream sources are enabled. Open Settings and enable at least one source.'
    : selectedMovie?.type === 'series' && !episodeSelection
      ? 'Choose a season and episode to load streams for this show.'
    : streamErrors.length
      ? `The enabled source did not return usable results. Check the warning below, refresh, or try another ${contentLabelSingular.toLowerCase()}.`
      : `No stream results were found for this ${contentLabelSingular.toLowerCase()} from the enabled sources. Try another profile, refresh, or choose another title.`

  function updatePreferences(patch: Partial<AppPreferences>) {
    setPreferences((current) => ({ ...current, ...patch }))
    if (patch.defaultProfile) setResultProfile(patch.defaultProfile)
    if (patch.libraryViewMode) setFocusedMovieIndex(0)
  }

  function handleApplyFilterPreset(preset: FilterPreset) {
    setMovieFilters({ ...preset.filters })
    closeModal()
  }

  function handleSaveFilterPreset(name: string) {
    const preset = createFilterPreset(name, movieFilters)
    const next = [...customFilterPresets, preset]
    setCustomFilterPresets(next)
    saveCustomFilterPresets(next)
  }

  function handleExportSettings() {
    downloadSettingsFile(buildSettingsExport(preferences, plugins, downloadConfig, layout, contentType))
  }

  function handleImportSettings() {
    importInputRef.current?.click()
  }

  async function handleImportSettingsFile(file: File) {
    try {
      const payload = parseSettingsExport(await file.text())
      setPreferences({
        ...defaultPreferences,
        ...payload.preferences,
        customProfiles: payload.preferences.customProfiles ?? [],
        theme: payload.preferences.theme ?? 'system',
        libraryViewMode: (payload.preferences.libraryViewMode === 'list' ? 'list' : 'grid') as LibraryViewMode,
      })
      setPlugins(payload.plugins)
      setDownloadConfig(migrateDownloadConfig({ ...defaultDownloadConfig, ...payload.downloadConfig }, tauri))
      setLayout({
        leftSidebarWidth: clampNumber(payload.layout.leftSidebarWidth, layoutLimits.leftMin, layoutLimits.leftMax),
        rightSidebarWidth: clampNumber(payload.layout.rightSidebarWidth, layoutLimits.rightMin, layoutLimits.rightMax),
      })
      if (payload.filterPresets?.length) {
        setCustomFilterPresets(payload.filterPresets)
        saveCustomFilterPresets(payload.filterPresets)
      }
      if (payload.contentType === 'series' || payload.contentType === 'movie') {
        setContentType(payload.contentType)
      }
      window.alert('Settings imported. API keys were not changed.')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import settings.')
    }
  }

  function handleSearchPerson(name: string) {
    setQuery(name)
    setSelectedMovie(null)
    setSearchHistoryOpen(false)
    searchRef.current?.focus()
  }

  function updateDownloadConfig(next: DownloadConfig) {
    setDownloadConfig(migrateDownloadConfig(next, tauri))
  }

  function openJellyfinSignIn(baseUrl: string, onToken: (token: string) => void) {
    setJellyfinSignInBaseUrl(baseUrl)
    setJellyfinSignInCallback(() => onToken)
    setJellyfinSignInOpen(true)
  }

  async function beginDownload(stream: StreamResult, index: number, destination: DownloadDestination) {
    if (!selectedMovie) return
    const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
    setDownloadingStreamKey(key)
    openDownloads()
    await queueDownload(stream, index, selectedMovie, episodeSelection, destination)
  }

  async function queueDownload(
    stream: StreamResult,
    index: number,
    movie: Movie,
    episode: { season: number; episode: number } | undefined,
    destination: DownloadDestination,
  ) {
    const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
    const id = stream.infoHash?.toLowerCase() ?? `${movie.id}-${episode?.episode ?? 'movie'}-${index}-${Date.now()}`
    const secrets = await loadDestinationSecrets(destination)
    const pollConfig = buildPollConfig(downloadConfig, destination, secrets, movie)
    setDownloadJobs((current) => [
      { pendingId: id, createdAt: new Date().toISOString(), movie, stream, destinationId: destination.id, destinationName: destination.name, pollConfig },
      ...current,
    ])
    try {
      const sourceUrl = await resolveStreamUrl(torboxApiKey, stream, stream.url?.startsWith('http') && !stream.infoHash ? stream.url : undefined)
      const request = { id, url: sourceUrl, filename: makeDownloadFilename(movie, stream, episode), folderName: makeMovieFolderName(movie, episode) }
      const legacy = destinationToLegacyConfig(downloadConfig, destination, secrets)
      const status = tauri
        ? await import('@tauri-apps/api/core').then(({ invoke }) => {
            if (pollConfig.mode === 'qbittorrent') {
              return invoke('start_qbittorrent_download', {
                config: qbittorrentPayload(legacy),
                request: { id, infoHash: null, magnetUrl: null, directUrl: sourceUrl, name: request.filename },
              })
            }
            if (pollConfig.mode === 'ssh') {
              return invoke('start_remote_url_download', { config: pollConfig.ssh, request })
            }
            return invoke('start_local_url_download', { config: pollConfig.local, request })
          })
        : await postApi('/api/downloads', { ...request, ...localPayload(legacy, movie) })
      setDownloadJobs((current) => [
        {
          pendingId: id,
          movie,
          stream,
          sourceUrl,
          status: status as never,
          destinationId: destination.id,
          destinationName: destination.name,
          pollConfig,
        },
        ...current.filter((job) => job.pendingId !== id),
      ])
    } catch (error) {
      setDownloadJobs((current) => [
        { pendingId: id, movie, stream, destinationId: destination.id, destinationName: destination.name, pollConfig, error: error instanceof Error ? error.message : 'Could not start download.' },
        ...current.filter((job) => job.pendingId !== id),
      ])
    } finally {
      setDownloadingStreamKey((current) => (current === key ? '' : current))
    }
  }

  async function startDownload(stream: StreamResult, index: number) {
    if (!selectedMovie) return
    if (!torboxApiKey.trim()) {
      setTorboxKeyPromptOpen(true)
      return
    }
    if (jellyfinMatch && topStreamQuality && jellyfinMatch.height && topStreamQuality <= jellyfinMatch.height) {
      const proceed = window.confirm(`${selectedMovie.name} already exists in Jellyfin at ${jellyfinMatch.qualityLabel || 'current quality'}. Download anyway?`)
      if (!proceed) return
    }

    const ready = readyDestinations(downloadConfig, tauri)
    if (!ready.length) {
      setPendingDownload({ stream, index })
      setDestinationPickerOpen(true)
      return
    }

    if (shouldPromptDestinationPicker(downloadConfig, tauri)) {
      setPendingDownload({ stream, index })
      setDestinationPickerOpen(true)
      return
    }

    const destination = getDefaultDestination(downloadConfig)
    if (!destination || !ready.some((entry) => entry.id === destination.id)) {
      setPendingDownload({ stream, index })
      setDestinationPickerOpen(true)
      return
    }

    await beginDownload(stream, index, destination)
  }

  async function handleDestinationPick(destination: DownloadDestination) {
    setDestinationPickerOpen(false)
    if (!pendingDownload) return
    const { stream, index } = pendingDownload
    setPendingDownload(null)
    await beginDownload(stream, index, destination)
  }

  const handlePlaybackFailure = useCallback(async () => {
    if (!playbackUrl) return
    if (!needsTranscodeFallback(currentSourceUrl, playbackUrl)) {
      setPlaybackUrl('')
      setPlaybackError(playbackUnavailableMessage())
      setPlaybackStatus('')
      return
    }
    setPlaybackStatus('Transcoding for AirPlay')
    setPlaybackError('')
    try {
      const hlsUrl = await startHlsTranscode(currentSourceUrl, selectedAudioIndex, selectedSubtitleIndex)
      setPlaybackUrl(hlsUrl)
      setPlaybackStatus('')
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not start fallback playback.')
      setPlaybackStatus('')
    }
  }, [currentSourceUrl, playbackUrl, selectedAudioIndex, selectedSubtitleIndex])

  async function preparePlayback(sourceUrl: string, title: string, audioIndex: number | null, subtitleIndex: number | null, resumeAt: number | null = null) {
    setPlaybackStatus('Opening')
    setPlaybackError('')
    setPlaybackUrl('')
    setPlaybackTitle(title)
    setPlaybackStartAt(resumeAt)
    setSelectedAudioIndex(audioIndex)
    setSelectedSubtitleIndex(subtitleIndex)

    void inspectMedia(sourceUrl).then((info) => {
      setMediaInfo(info)
      if (audioIndex === null && info?.audioTracks[0]?.index !== undefined) {
        setSelectedAudioIndex(info.audioTracks[0].index)
      }
    })

    if (!shouldTranscodeDirectly(sourceUrl, audioIndex, subtitleIndex)) {
      setPlaybackUrl(sourceUrl)
      setPlaybackStatus('')
      return
    }

    setPlaybackStatus(audioIndex === null && subtitleIndex === null ? 'Transcoding' : 'Preparing')
    try {
      const hlsUrl = await startHlsTranscode(sourceUrl, audioIndex, subtitleIndex)
      setPlaybackUrl(hlsUrl)
      setPlaybackStatus('')
    } catch (error) {
      setPlaybackStatus('')
      setPlaybackError(error instanceof Error ? error.message : 'Could not start transcoded playback.')
    }
  }

  async function chooseAudioTrack(value: string) {
    if (!currentSourceUrl) return
    const index = value ? Number(value) : null
    setSelectedAudioIndex(index)
    await preparePlayback(currentSourceUrl, playbackTitle || 'Player', index, selectedSubtitleIndex)
  }

  async function chooseSubtitleTrack(value: string) {
    if (!currentSourceUrl) return
    const index = value ? Number(value) : null
    setSelectedSubtitleIndex(index)
    await preparePlayback(currentSourceUrl, playbackTitle || 'Player', selectedAudioIndex, index)
  }

  function episodePlaybackLabel() {
    if (!episodeSelection) return ''
    return ` S${String(episodeSelection.season).padStart(2, '0')}E${String(episodeSelection.episode).padStart(2, '0')}`
  }

  function handleSeasonChange(season: number) {
    setSelectedSeason(season)
    const firstEpisode = seriesEpisodes?.find((entry) => entry.season === season)
    setSelectedEpisode(firstEpisode?.episode ?? null)
  }

  async function playStream(stream: StreamResult, index: number) {
    if (!selectedMovie) return
    const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
    setResolvingStreamKey(key)
    setPlaybackError('')
    setPlaybackStatus('Resolving')
    setPlaybackUrl('')
    setCurrentSourceUrl('')
    setMediaInfo(null)
    setSelectedAudioIndex(null)
    setSelectedSubtitleIndex(null)
    const resumeAt = getPlaybackResumePosition(selectedMovie, episodeSelection?.season, episodeSelection?.episode)
    try {
      const directUrl = stream.url?.startsWith('http') && !stream.infoHash ? stream.url : undefined
      const sourceUrl = await resolveStreamUrl(torboxApiKey, stream, directUrl)
      setCurrentSourceUrl(sourceUrl)
      await preparePlayback(
        sourceUrl,
        `${selectedMovie.name}${episodePlaybackLabel()} - ${stream.pluginName}`,
        null,
        null,
        resumeAt,
      )
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not start playback.')
      setPlaybackStatus('')
    } finally {
      setResolvingStreamKey('')
    }
  }

  const handlePlaybackTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (!selectedMovie) return
      savePlaybackPosition(selectedMovie, currentTime, duration, episodeSelection?.season, episodeSelection?.episode)
    },
    [episodeSelection?.episode, episodeSelection?.season, selectedMovie],
  )

  const handlePlaybackEnded = useCallback(() => {
    if (!selectedMovie || selectedMovie.type !== 'series' || !preferences.autoPlayNextEpisode || !episodeSelection || !seriesEpisodes?.length) {
      return
    }
    const next = nextEpisode(seriesEpisodes, episodeSelection)
    if (!next) return
    pendingAutoPlayRef.current = true
    setSelectedSeason(next.season)
    setSelectedEpisode(next.episode)
    setPlaybackUrl('')
    setPlaybackStatus('Loading next episode')
  }, [episodeSelection, preferences.autoPlayNextEpisode, selectedMovie, seriesEpisodes])

  useEffect(() => {
    if (!pendingAutoPlayRef.current || streamsLoading || !compactStreams.length) return
    pendingAutoPlayRef.current = false
    setPlaybackStatus('')
    void playStream(compactStreams[0]!, 0)
  }, [compactStreams, streamsLoading, episodeSelection?.episode, episodeSelection?.season])

  async function downloadSeason() {
    if (!selectedMovie || selectedMovie.type !== 'series' || selectedSeason === null || !seriesEpisodes?.length) return
    const destination = getDefaultDestination(downloadConfig)
    if (!destination || !readyDestinations(downloadConfig, tauri).some((entry) => entry.id === destination.id)) {
      openSettings('downloads')
      return
    }
    const episodes = seriesEpisodes.filter((entry) => entry.season === selectedSeason)
    if (!episodes.length) return
    setBatchDownloading(true)
    openDownloads()
    try {
      for (const entry of episodes) {
        const urlResults = await Promise.allSettled(
          activePlugins.map(async (plugin) => {
            const url = hydrateUrl(plugin.streamUrlTemplate, selectedMovie, torboxApiKey, 'series', { season: entry.season, episode: entry.episode })
            return normalizeStreams(plugin.name, await loadJson<unknown>(url))
          }),
        )
        const found = urlResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
        const best = filterStreamsForProfile(found.sort((a, b) => b.rank - a.rank), resultProfile, preferences.preferCachedResults, activeCustomProfile)[0]
        if (best) await queueDownload(best, entry.episode, selectedMovie, { season: entry.season, episode: entry.episode }, destination)
      }
    } finally {
      setBatchDownloading(false)
    }
  }

  async function cancelDownloadJob(job: DownloadJob) {
    const id = job.status?.id ?? job.pendingId
    setDownloadJobs((current) => current.filter((item) => item !== job))
    if (!id) return
    if (tauri) {
      const mode = job.pollConfig?.mode
      await import('@tauri-apps/api/core').then(({ invoke }) => {
        if (mode === 'local') return invoke('cancel_local_url_download', { id })
        return invoke('cancel_remote_url_download', { id })
      }).catch(() => undefined)
    } else if (!job.status?.complete) {
      await fetch(`/api/downloads/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined)
    }
  }

  function pauseDownloadJob(job: DownloadJob) {
    setDownloadJobs((current) => current.map((entry) => (entry === job ? { ...entry, paused: true } : entry)))
  }

  function resumeDownloadJob(job: DownloadJob) {
    setDownloadJobs((current) => current.map((entry) => (entry === job ? { ...entry, paused: false } : entry)))
  }

  function handleToggleWatchlist(movie: Movie) {
    setWatchlist(toggleWatchlist(movie))
  }

  function handleSelectMovie(movie: Movie) {
    setSelectedMovie(movie)
    setRecentViews(recordRecentView(movie))
    setFocusedMovieIndex(displayedMovies.findIndex((entry) => entry.id === movie.id))
    if (!isDesktop) setSidebarOpen(false)
  }

  function handleCloseInspector() {
    setSelectedMovie(null)
    setPlaybackUrl('')
    setPlaybackError('')
    setPlaybackStatus('')
  }

  useKeyboardShortcuts({
    modalOpen: filtersOpen || downloadsOpen || preferencesOpen || jellyfinSignInOpen || torboxKeyPromptOpen || Boolean(confirmRemove),
    displayedMovies,
    focusedMovieIndex,
    setFocusedMovieIndex,
    onSelectMovie: handleSelectMovie,
    onFocusSearch: () => searchRef.current?.focus(),
    onOpenSettings: () => openSettings('general'),
    onPlayTopStream: () => {
      if (compactStreams[0]) void playStream(compactStreams[0], 0)
    },
    onCloseModals: () => {
      if (torboxKeyPromptOpen) {
        setTorboxKeyPromptOpen(false)
        return
      }
      if (filtersOpen || downloadsOpen || preferencesOpen || jellyfinSignInOpen || confirmRemove) {
        setJellyfinSignInOpen(false)
        setConfirmRemove(null)
        closeModal()
        return
      }
      if (!isDesktop && selectedMovie) {
        handleCloseInspector()
        return
      }
      if (!isDesktop && sidebarOpen) {
        setSidebarOpen(false)
      }
    },
    compactStreams,
  })

  const loadNextPage = useCallback(async () => {
    if (shouldRemoteSearch || loadingMoreMovies || !hasMoreMovies) return
    setLoadingMoreMovies(true)
    try {
      const body = await loadJson<{ metas?: unknown[] }>(catalogPageUrl(filteredCatalogUrl, catalogSkip))
      const incoming = (body.metas || []).map((item) => normalizeCatalogItem(item as never, contentType)).filter(Boolean) as Movie[]
      setMovies((current) => appendUniqueMovies(current, incoming))
      setCatalogSkip((current) => current + catalogPageSize)
      setHasMoreMovies(incoming.length > 0)
      setMovieError('')
    } catch (error) {
      setMovieError(error instanceof Error ? error.message : 'Could not load more movies')
    } finally {
      setLoadingMoreMovies(false)
    }
  }, [catalogSkip, contentType, filteredCatalogUrl, hasMoreMovies, loadingMoreMovies, shouldRemoteSearch])

  useEffect(() => {
    if (shouldRemoteSearch || !hasMoreMovies) return
    const marker = loadMoreRef.current
    if (!marker) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadNextPage()
        }
      },
      { rootMargin: '700px 0px' },
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [hasMoreMovies, loadNextPage, shouldRemoteSearch])

  function startSidebarResize(side: 'left' | 'right', event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startX = event.clientX
    const startLayout = layout
    document.body.classList.add('is-resizing-layout')
    function onPointerMove(moveEvent: PointerEvent) {
      const delta = moveEvent.clientX - startX
      if (side === 'left') {
        setLayout((current) => ({
          ...current,
          leftSidebarWidth: clampNumber(startLayout.leftSidebarWidth + delta, layoutLimits.leftMin, layoutLimits.leftMax),
        }))
      } else {
        setLayout((current) => ({
          ...current,
          rightSidebarWidth: clampNumber(startLayout.rightSidebarWidth - delta, layoutLimits.rightMin, layoutLimits.rightMax),
        }))
      }
    }
    function onPointerUp() {
      document.body.classList.remove('is-resizing-layout')
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  return (
    <main className="h-screen overflow-hidden bg-[var(--mac-window)] text-[var(--mac-text)]">
      {/* Mobile sidebar backdrop */}
      {!isDesktop ? (
        <div
          className={`app-sidebar-backdrop ${sidebarOpen ? 'is-open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="app-shell grid h-full" style={shellStyle}>
        {/* Desktop sidebar (in grid) */}
        {isDesktop ? (
          <Sidebar
            contentType={contentType}
            catalogId={catalogId}
            activePluginCount={activePluginCount}
            watchlistCount={watchlist.length}
            continueCount={continueWatchingMovies().length}
            recentCount={recentViews.length}
            preferencesOpen={preferencesOpen}
            downloadsOpen={downloadsOpen}
            downloadSummary={downloadSummary}
            onContentTypeChange={setContentType}
            onCatalogChange={setCatalogId}
            onOpenPreferences={() => openSettings('general')}
            onOpenDownloads={openDownloads}
            onResetSelection={() => setSelectedMovie(null)}
          />
        ) : null}

        {/* Mobile slide-in drawer */}
        {!isDesktop ? (
          <Sidebar
            mobile
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            contentType={contentType}
            catalogId={catalogId}
            activePluginCount={activePluginCount}
            watchlistCount={watchlist.length}
            continueCount={continueWatchingMovies().length}
            recentCount={recentViews.length}
            preferencesOpen={preferencesOpen}
            downloadsOpen={downloadsOpen}
            downloadSummary={downloadSummary}
            onContentTypeChange={setContentType}
            onCatalogChange={setCatalogId}
            onOpenPreferences={() => openSettings('general')}
            onOpenDownloads={openDownloads}
            onResetSelection={() => setSelectedMovie(null)}
          />
        ) : null}

        <button
          type="button"
          className="app-splitter app-splitter-left"
          onPointerDown={(event) => startSidebarResize('left', event)}
          aria-label="Resize library sidebar"
          aria-orientation="vertical"
        />

        <section className="flex min-h-0 min-w-0 flex-col">
          <header className="mac-toolbar flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-4">
            {!isDesktop ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="app-mobile-menu-btn lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold tracking-normal">{selectedCatalog.label}</h2>
              <p className="text-[11px] text-[var(--mac-secondary)]">
                {(catalogLoading || searchLoading) ? 'Loading' : `${displayedMovies.length} ${displayedMovies.length === 1 ? contentLabelSingular : contentLabelPlural}`}
              </p>
            </div>
            <div className="relative w-40 shrink-0 sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2 text-[var(--mac-tertiary)]" size={15} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setSearchHistoryOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchHistoryOpen(false), 120)}
                placeholder="Search"
                className="h-8 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] pl-8 pr-2 text-[13px] outline-none transition placeholder:text-[var(--mac-tertiary)] focus:border-[var(--mac-accent)]"
              />
              {searchHistoryOpen && searchHistory.length && !query.trim() ? (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-md border border-[var(--mac-border)] bg-[var(--mac-elevated)] py-1 shadow-lg">
                  {searchHistory.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(entry)
                        setSearchHistoryOpen(false)
                        searchRef.current?.focus()
                      }}
                      className="block w-full truncate px-3 py-1.5 text-left text-[12px] hover:bg-[var(--mac-control)]"
                    >
                      {entry}
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      clearSearchHistory()
                      setSearchHistory([])
                      setSearchHistoryOpen(false)
                    }}
                    className="block w-full border-t border-[var(--mac-border)] px-3 py-1.5 text-left text-[11px] text-[var(--mac-secondary)] hover:bg-[var(--mac-control)]"
                  >
                    Clear history
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => updatePreferences({ libraryViewMode: preferences.libraryViewMode === 'grid' ? 'list' : 'grid' })}
              className="grid size-8 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] transition hover:bg-[var(--mac-control-hover)]"
              title={preferences.libraryViewMode === 'grid' ? 'List view' : 'Grid view'}
            >
              {preferences.libraryViewMode === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
            </button>
            <button
              type="button"
              onClick={openFilters}
              className={`grid size-8 place-items-center rounded-md border border-[var(--mac-border)] transition hover:bg-[var(--mac-control-hover)] ${
                Object.values(movieFilters).some((value) => value && value !== 'catalog')
                  ? 'bg-[var(--mac-accent)] text-[var(--mac-accent-text)]'
                  : 'bg-[var(--mac-control)]'
              }`}
              title="Filters"
            >
              <SlidersHorizontal size={16} />
            </button>
          </header>

          {preferences.libraryViewMode === 'list' ? (
            <MovieList
              movies={displayedMovies}
              selectedMovieId={selectedMovie?.id}
              focusedMovieIndex={focusedMovieIndex}
              catalogId={catalogId}
              watchlistIds={watchlistIds}
              showYears={preferences.showYears}
              showRatings={preferences.showRatings}
              loading={moviesLoading}
              movieErrorMessage={movieErrorMessage}
              searchErrorMessage={searchErrorMessage}
              onSelectMovie={handleSelectMovie}
              onToggleWatchlist={handleToggleWatchlist}
            />
          ) : (
            <MovieGrid
              movies={displayedMovies}
              selectedMovieId={selectedMovie?.id}
              focusedMovieIndex={focusedMovieIndex}
              catalogId={catalogId}
              watchlistIds={watchlistIds}
              posterSize={preferences.posterSize}
              showYears={preferences.showYears}
              showRatings={preferences.showRatings}
              loading={moviesLoading}
              loadingMore={loadingMoreMovies}
              movieErrorMessage={movieErrorMessage}
              searchErrorMessage={searchErrorMessage}
              hasMoreMovies={hasMoreMovies}
              shouldRemoteSearch={shouldRemoteSearch}
              loadMoreRef={loadMoreRef}
              onSelectMovie={handleSelectMovie}
              onToggleWatchlist={handleToggleWatchlist}
            />
          )}
        </section>

        <button
          type="button"
          className="app-splitter app-splitter-right max-lg:hidden"
          onPointerDown={(event) => startSidebarResize('right', event)}
          aria-label="Resize movie details sidebar"
          aria-orientation="vertical"
        />

        <InspectorPanel
          movie={inspectorMovie}
          inWatchlist={selectedMovie ? isInWatchlist(selectedMovie) : false}
          onToggleWatchlist={() => {
            if (!selectedMovie) return
            handleToggleWatchlist(selectedMovie)
          }}
          similarMovies={similarMovies}
          onSelectSimilar={handleSelectMovie}
          onSearchPerson={handleSearchPerson}
          jellyfinMatch={jellyfinMatch}
          jellyfinLoading={jellyfinLoading}
          jellyfinUrl={jellyfinItemUrl}
          topStreamQuality={topStreamQuality}
          episodeOptions={seriesEpisodes || []}
          loadingEpisodes={seriesMetaLoading}
          episodeLoadError={seriesMetaError ? (seriesMetaError instanceof Error ? seriesMetaError.message : 'Could not load episodes') : ''}
          selectedSeason={selectedSeason}
          selectedEpisode={selectedEpisode}
          onSeasonChange={handleSeasonChange}
          onEpisodeChange={setSelectedEpisode}
          onDownloadSeason={() => { void downloadSeason() }}
          batchDownloading={batchDownloading}
          streams={streams}
          compactStreams={compactStreams}
          profileOptions={profileOptions}
          loadingStreams={streamsLoading}
          streamErrors={streamErrors}
          streamEmptyMessage={streamEmptyMessage}
          resultProfile={resultProfile}
          resultsExpanded={resultsExpanded}
          playbackUrl={playbackUrl}
          playbackTitle={playbackTitle}
          playbackError={playbackError}
          playbackStatus={playbackStatus}
          playbackStartAt={playbackStartAt}
          mediaInfo={mediaInfo}
          selectedAudioIndex={selectedAudioIndex}
          selectedSubtitleIndex={selectedSubtitleIndex}
          onPlaybackError={handlePlaybackFailure}
          onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
          onPlaybackEnded={handlePlaybackEnded}
          resolvingKey={resolvingStreamKey}
          downloadingKey={downloadingStreamKey}
          onChooseAudio={(value) => { void chooseAudioTrack(value) }}
          onChooseSubtitle={(value) => { void chooseSubtitleTrack(value) }}
          onRefreshStreams={() => { void refreshStreams() }}
          onResultProfileChange={setResultProfile}
          onToggleResultsExpanded={() => setResultsExpanded((current) => !current)}
          onPlay={playStream}
          onDownload={startDownload}
          mobileOpen={!isDesktop && Boolean(selectedMovie)}
          onMobileClose={handleCloseInspector}
        />

        <FiltersModal
          open={filtersOpen}
          filters={movieFilters}
          presets={filterPresets}
          onClose={closeModal}
          onChange={setMovieFilters}
          onReset={() => setMovieFilters(defaultMovieFilters)}
          onApplyPreset={handleApplyFilterPreset}
          onSavePreset={handleSaveFilterPreset}
        />
        <DownloadsModal
          open={downloadsOpen}
          jobs={downloadJobs}
          sort={downloadSort}
          sortOpen={downloadSortOpen}
          onClose={() => { setDownloadSortOpen(false); closeModal() }}
          onSortOpen={setDownloadSortOpen}
          onSortChange={setDownloadSort}
          onClearFinished={() => setDownloadJobs((current) => current.filter((job) => !(job.status?.complete || job.status?.state.startsWith('error:') || job.error)))}
          onRemoveJob={setConfirmRemove}
          onPauseJob={pauseDownloadJob}
          onResumeJob={resumeDownloadJob}
        />
        <DownloadDestinationPicker
          open={destinationPickerOpen}
          title={selectedMovie ? `Download “${selectedMovie.name}”` : 'Choose destination'}
          subtitle={pendingDownload ? 'Pick where this file should be saved.' : undefined}
          destinations={readyDestinations(downloadConfig, tauri)}
          loading={Boolean(downloadingStreamKey)}
          onClose={() => {
            setDestinationPickerOpen(false)
            setPendingDownload(null)
            setDownloadingStreamKey('')
          }}
          onSelect={(destination) => { void handleDestinationPick(destination) }}
          onSetup={() => {
            setDestinationPickerOpen(false)
            openSettings('downloads')
          }}
          onManage={() => {
            setDestinationPickerOpen(false)
            openSettings('downloads')
          }}
        />
        <PreferencesModal
          open={preferencesOpen}
          tab={preferencesTab}
          plugins={plugins}
          resultProfiles={resultProfiles}
          preferences={preferences}
          downloadConfig={downloadConfig}
          torboxApiKey={torboxApiKey}
          onClose={closeModal}
          onTabChange={setSettingsTab}
          onUpdatePlugin={(pluginId, patch) => setPlugins((current) => current.map((plugin) => (plugin.id === pluginId ? { ...plugin, ...patch } : plugin)))}
          onUpdatePreferences={updatePreferences}
          onUpdateDownloadConfig={updateDownloadConfig}
          onChangeTorboxApiKey={setTorboxApiKey}
          onOpenJellyfinSignIn={openJellyfinSignIn}
          onExportSettings={handleExportSettings}
          onImportSettings={handleImportSettings}
        />
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void handleImportSettingsFile(file)
          }}
        />
      <JellyfinSignInModal
        open={jellyfinSignInOpen}
        onClose={() => {
          setJellyfinSignInOpen(false)
          setJellyfinSignInCallback(null)
        }}
        onSubmit={async (username, password) => {
          const baseUrl = jellyfinSignInBaseUrl || effectiveDownloadConfig.jellyfinUrl
          try {
            const token = tauri
              ? await import('@tauri-apps/api/core').then(({ invoke }) => invoke<string>('authenticate_jellyfin', { baseUrl, username, password }))
              : await postApi<{ token: string }>('/api/jellyfin/auth', { baseUrl, username, password }).then((body) => body.token)
            if (jellyfinSignInCallback) {
              jellyfinSignInCallback(token)
            } else {
              setJellyfinApiKey(token)
            }
            setJellyfinSignInOpen(false)
            setJellyfinSignInCallback(null)
          } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Could not sign in to Jellyfin.')
          }
        }}
      />
      <ConfirmationDialog
        open={torboxKeyPromptOpen}
        title="Torbox API key required"
        message="Downloads need a Torbox API key to resolve streams. Add your key in Settings → Plugins to continue."
        confirmLabel="Open Settings"
        confirmTone="primary"
        onCancel={() => setTorboxKeyPromptOpen(false)}
        onConfirm={() => {
          setTorboxKeyPromptOpen(false)
          openSettings('plugins')
        }}
      />
      <ConfirmationDialog
        open={Boolean(confirmRemove)}
        title="Remove download"
        message={confirmRemove?.status && !confirmRemove.status.complete ? 'This will remove the row and cancel the active download.' : 'This will remove the row from the download list.'}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => {
          if (!confirmRemove) return
          await cancelDownloadJob(confirmRemove)
          setConfirmRemove(null)
        }}
      />
      </div>
    </main>
  )
}
