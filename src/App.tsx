import { LayoutGrid, List, Menu, Search, SlidersHorizontal } from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'

import { FocusZone } from './components/FocusZone'
import { ConfirmationDialog } from './components/ConfirmationDialog'
import { DownloadDestinationPicker } from './components/DownloadDestinationPicker'
import { DownloadsModal } from './components/DownloadsModal'
import { FiltersModal } from './components/FiltersModal'
import { FirstRunSetup } from './components/FirstRunSetup'
import { InspectorPanel } from './components/InspectorPanel'
import { JellyfinSignInModal } from './components/JellyfinSignInModal'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { LegalNoticeModal } from './components/LegalNoticeModal'
import { MovieGrid } from './components/MovieGrid'
import { MovieList } from './components/MovieList'
import { PreferencesModal } from './components/PreferencesModal'
import { Sidebar } from './components/Sidebar'
import { useAppModalRoute } from './hooks/useAppModalRoute'
import { useCatalogPullRefresh } from './hooks/useCatalogPullRefresh'
import { useCatalogScrollLoad } from './hooks/useCatalogScrollLoad'
import { useJellyfinCatalogStatus } from './hooks/useJellyfinCatalogStatus'
import { readAppRoute } from './lib/app-routes'
import { useSearchQueryRoute } from './hooks/useSearchQueryRoute'
import { useDockBadge } from './hooks/useDockBadge'
import { useErrorListToast, useMessageToast } from './hooks/useErrorToasts'
import { useDownloadNotifications } from './hooks/useDownloadNotifications'
import { loadServerDownloads, useDownloadPolling } from './hooks/useDownloadPolling'
import { liveMetricsForJob, useLiveDownloadMetrics } from './hooks/useLiveDownloadMetrics'
import { useJellyfinRefresh } from './hooks/useJellyfinRefresh'
import { useAppFocusNavigation } from './hooks/useAppFocusNavigation'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useSecrets } from './hooks/useSecrets'
import { getApi, isTauriRuntime, loadJson, postApi, resolveStreamUrl, setApiRequestTimeoutSeconds } from './lib/api'
import { catalogPageUrl, catalogSupportsPagination, enrichMovieFromMeta, isCatalogEndError, metaUrl, normalizeCatalogItem, normalizeSeriesEpisodes, similarMoviesFromMeta, searchUrl } from './lib/cinemeta'
import { allProfileOptions, builtinProfileList, findCustomProfile } from './lib/custom-profiles'
import { createFilterPreset, findFilterPresetByRouteSlug, loadCustomFilterPresets, presetRouteSlug, saveCustomFilterPresets } from './lib/filter-presets'
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
  downloadJobKey,
  downloadSidebarSummary,
  isActiveDownloadJob,
  isDownloadDismissed,
  loadDismissedDownloadIds,
  localPayload,
  makeDownloadFilename,
  makeMovieFolderName,
  markDownloadDismissed,
  mergeServerDownloadJobs,
  qbittorrentPayload,
  serverDownloadJellyfinPayload,
  withDownloadTimestamp,
} from './lib/downloads'
import { appendUniqueMovies, catalogOptions, catalogUrlMap, catalogUrlWithFilters, clientFiltersForCatalog, defaultMovieFilters, filterAndSortMovies, isLibraryCatalog, libraryCatalogOptions } from './lib/movies'
import { clearSearchHistory, loadRecentViews, loadSearchHistory, recordRecentView, recordSearchQuery, setRecentViewsLimit } from './lib/history'
import { hydrateUrl, hasEnabledStreamSources, loadSavedPlugins, pluginNeedsTorboxKey } from './lib/plugins'
import { buildSettingsExport, downloadSettingsFile, parseSettingsExport } from './lib/settings-export'
import { applyThemeMode, saveThemeMode } from './lib/theme'
import { toast } from './lib/toast'
import { getPlaybackResumePosition, nextEpisode, savePlaybackPosition, continueWatchingMovies, setPlaybackProgressConfig } from './lib/playback-progress'
import { loadPreferences, normalizePreferences, resolveStartupCatalogId, resolveStartupContentType } from './lib/preferences'
import { inspectMedia, isRetriablePlaybackError, needsTranscodeFallback, playbackUnavailableMessage, resolvePlaybackUrl, shouldTranscodeDirectly, startHlsTranscode } from './lib/playback'
import { isMacTauri, openNativePlayer } from './lib/native-player'
import { playbackPrepareStatus } from './lib/transcode-strategy'
import { jellyfinPlayUrl, lookupJellyfinSeasonEpisodes, fetchJellyfinFavorites, lookupJellyfinLibrary, streamTargetQuality } from './lib/jellyfin-library'
import { filterStreamsForProfile, normalizeStreams } from './lib/streams'
import { streamDirectUrl, streamNeedsTorboxResolve } from './lib/streams-display'
import { STORAGE_KEYS, loadStoredJson, loadStoredString, saveStoredJson, saveStoredString } from './lib/storage'
import { isInWatchlist, loadWatchlist, mergeWatchlist, toggleWatchlist } from './lib/watchlist'
import type {
  AppPreferences,
  ContentType,
  DownloadConfig,
  DownloadDestination,
  DownloadJob,
  DownloadSort,
  FilterPreset,
  JellyfinLibraryMatch,
  MediaInfo,
  Movie,
  PluginConfig,
  PreferencesTab,
  ResultProfile,
  StreamResult,
} from './types'


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

function loadDownloadConfig() {
  const stored = loadStoredJson(STORAGE_KEYS.downloadConfig, defaultDownloadConfig)
  return migrateDownloadConfig(stored, isTauriRuntime())
}

function initialBrowseState() {
  const route = readAppRoute()
  const preferences = loadPreferences()
  const isDefaultHome =
    typeof window !== 'undefined' &&
    window.location.pathname === '/' &&
    !route.title &&
    !route.modal &&
    !route.searchQuery
  if (isDefaultHome) {
    return {
      contentType: resolveStartupContentType(preferences),
      catalogId: resolveStartupCatalogId(preferences),
      query: '',
    }
  }
  return {
    contentType: route.contentType,
    catalogId: route.catalogId,
    query: route.searchQuery ?? '',
  }
}

export default function App() {
  const tauri = isTauriRuntime()
  const initialBrowse = initialBrowseState()
  const [contentType, setContentType] = useState<ContentType>(initialBrowse.contentType)
  const [catalogId, setCatalogId] = useState<string>(initialBrowse.catalogId)
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
  const [destinationSecretMap, setDestinationSecretMap] = useState<Record<string, { sshPassword: string }>>({})
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false)
  const [pendingDownload, setPendingDownload] = useState<{ stream: StreamResult; index: number } | null>(null)
  const [torboxKeyPromptOpen, setTorboxKeyPromptOpen] = useState(false)
  const [jellyfinSignInBaseUrl, setJellyfinSignInBaseUrl] = useState('')
  const [jellyfinSignInCallback, setJellyfinSignInCallback] = useState<((token: string) => void) | null>(null)
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>(() => {
    const dismissed = loadDismissedDownloadIds()
    return dedupeDownloadJobs(
      loadStoredJson<DownloadJob[]>(STORAGE_KEYS.downloadJobs, [])
        .map(withDownloadTimestamp)
        .filter((job) => !isDownloadDismissed(job, dismissed)),
    )
  })
  const [downloadSort, setDownloadSort] = useState<DownloadSort>(loadStoredJson<DownloadSort>(STORAGE_KEYS.downloadSort, 'newest'))
  const [downloadSortOpen, setDownloadSortOpen] = useState(false)
  const [resultProfile, setResultProfile] = useState<ResultProfile>(preferences.defaultProfile)
  const [resultsExpanded, setResultsExpanded] = useState(() => loadPreferences().expandStreamResultsByDefault)
  const [streams, setStreams] = useState<StreamResult[]>([])
  const [streamErrors, setStreamErrors] = useState<string[]>([])
  const [resolvingStreamKey, setResolvingStreamKey] = useState('')
  const [downloadingStreamKey, setDownloadingStreamKey] = useState('')
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [nativePlayback, setNativePlayback] = useState<{ player: string; title: string; mode: 'external' | 'window' } | null>(null)
  const [currentSourceUrl, setCurrentSourceUrl] = useState('')
  const [playbackTitle, setPlaybackTitle] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [playbackStatus, setPlaybackStatus] = useState('')
  const [playbackStartAt, setPlaybackStartAt] = useState<number | null>(null)
  const [playbackDuration, setPlaybackDuration] = useState<number | null>(null)
  const [playbackMediaOffset, setPlaybackMediaOffset] = useState(0)
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
  const [legalOpen, setLegalOpen] = useState(false)
  const [preferencesTab, setPreferencesTab] = useState<PreferencesTab>('general')
  const [jellyfinSignInOpen, setJellyfinSignInOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<DownloadJob | null>(null)
  const [layout, setLayout] = useState(loadSavedLayout)
  const [movieError, setMovieError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const moviePanelScrollRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const pendingAutoPlayRef = useRef(false)
  const autoPlayedStreamKeyRef = useRef<string | null>(null)
  const playbackGenerationRef = useRef(0)
  const playbackRecoveryCountRef = useRef(0)
  const lastPlaybackErrorRef = useRef('')
  const activePlaybackStreamRef = useRef<{ stream: StreamResult; index: number } | null>(null)
  const [nextEpisodePrompt, setNextEpisodePrompt] = useState<{ remaining: number; next: { season: number; episode: number } } | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [firstRunOpen, setFirstRunOpen] = useState(false)
  const [firstRunLegalAccepted, setFirstRunLegalAccepted] = useState(
    () => loadStoredString(STORAGE_KEYS.legalNoticeAccepted, '') === '1',
  )
  const startupSyncedRef = useRef(false)
  const dismissedDownloadIdsRef = useRef(loadDismissedDownloadIds())

  const { torboxApiKey, jellyfinApiKey, sshPassword, loaded: secretsLoaded, setTorboxApiKey, setJellyfinApiKey } = useSecrets()
  const {
    route,
    closeModal,
    openSettings,
    openDownloads,
    openFilters,
    openLegal,
    setSettingsTab,
    navigateBrowse,
    navigatePreset,
    navigateSearch,
    navigateToTitle,
    closeTitle,
  } = useAppModalRoute()
  const { query, setQuery, debouncedQuery } = useSearchQueryRoute({
    initialQuery: initialBrowse.query,
    route,
    contentType,
    catalogId,
    navigateSearch,
    navigateBrowse,
  })
  const titleLoadRef = useRef<string | null>(null)
  const shouldRemoteSearch = debouncedQuery.length >= 2
  const selectedCatalog = [...libraryCatalogOptions, ...catalogOptions].find((item) => item.id === catalogId) ?? catalogOptions[0]
  const activeFilterPreset = route.presetId
    ? findFilterPresetByRouteSlug(route.presetId, customFilterPresets)
    : undefined
  const browseTitle = activeFilterPreset?.name ?? selectedCatalog.label
  const baseCatalogUrl = isLibraryCatalog(catalogId) ? '' : catalogUrlMap(contentType)[selectedCatalog.id as keyof ReturnType<typeof catalogUrlMap>]
  const filteredCatalogUrl = baseCatalogUrl
    ? catalogUrlWithFilters(baseCatalogUrl || catalogUrlMap(contentType).trending, movieFilters, contentType, catalogId)
    : ''
  const contentLabelPlural = contentType === 'series' ? 'Shows' : 'Movies'
  const contentLabelSingular = contentType === 'series' ? 'Show' : 'Movie'
  const activePlugins = useMemo(() => plugins.filter((plugin) => plugin.enabled && plugin.streamUrlTemplate.trim() && (!pluginNeedsTorboxKey(plugin) || torboxApiKey.trim())), [plugins, torboxApiKey])
  const showStreamResults = useMemo(() => hasEnabledStreamSources(plugins), [plugins])
  const shellStyle = {
    '--left-sidebar-width': `${layout.leftSidebarWidth}px`,
    '--right-sidebar-width': `${layout.rightSidebarWidth}px`,
  } as CSSProperties

  const profileOptions = useMemo(() => allProfileOptions(preferences), [preferences])
  const liveDownloadMetrics = useLiveDownloadMetrics(downloadJobs)
  const downloadSummary = useMemo(() => {
    const summary = downloadSidebarSummary(downloadJobs)
    const topProgress = downloadJobs
      .filter((job) => isActiveDownloadJob(job))
      .reduce((max, job) => Math.max(max, liveMetricsForJob(job, liveDownloadMetrics)?.progress ?? job.status?.progress ?? 0), 0)
    return { ...summary, topProgress }
  }, [downloadJobs, liveDownloadMetrics])
  const activeCustomProfile = useMemo(() => findCustomProfile(preferences, resultProfile), [preferences, resultProfile])
  const inspectorMovie = enrichedMovie ?? selectedMovie
  const watchlistIds = useMemo(() => new Set(watchlist.map((movie) => `${movie.type}:${movie.id}`)), [watchlist])

  const { data: catalogData, error: catalogError, isLoading: catalogLoading, isValidating: catalogValidating, mutate: mutateCatalog } = useSWR(
    isLibraryCatalog(catalogId) ? null : ['catalog', contentType, filteredCatalogUrl],
    ([, type, url]) => loadJson<{ metas?: unknown[] }>(catalogPageUrl(url, 0)).then((body) => (body.metas || []).map((item) => normalizeCatalogItem(item as never, type as ContentType)).filter(Boolean) as Movie[]),
    { keepPreviousData: false },
  )
  const { data: searchData, error: searchError, isLoading: searchLoading, isValidating: searchValidating, mutate: mutateSearch } = useSWR(shouldRemoteSearch ? ['search', contentType, debouncedQuery] : null, ([, type, value]) => loadJson<{ metas?: unknown[] }>(searchUrl(value, type as ContentType)).then((body) => (body.metas || []).map((item) => normalizeCatalogItem(item as never, type as ContentType)).filter(Boolean) as Movie[]))
  const { data: seriesEpisodes, error: seriesMetaError, isLoading: seriesMetaLoading } = useSWR(
    selectedMovie?.type === 'series' ? ['series-meta', selectedMovie.id] : null,
    () => loadJson<{ meta?: { videos?: unknown[] } }>(metaUrl('series', selectedMovie!.id)).then((body) => normalizeSeriesEpisodes(body)),
  )
  const episodeSelection = useMemo(() => {
    if (selectedMovie?.type !== 'series' || selectedSeason === null || selectedEpisode === null) return undefined
    return { season: selectedSeason, episode: selectedEpisode }
  }, [selectedEpisode, selectedMovie?.type, selectedSeason])
  const { data: streamData, error: streamError, isLoading: streamsLoading, mutate: refreshStreams } = useSWR(
    selectedMovie && showStreamResults && (selectedMovie.type === 'movie' || episodeSelection)
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
  const { data: serverStatuses } = useSWR(tauri ? null : '/api/downloads', loadServerDownloads, {
    refreshInterval: 500,
    dedupingInterval: 0,
  })
  const { data: serverHealth } = useSWR(tauri ? null : '/api/health', () => getApi<{ downloadDir: string }>('/api/health'), { revalidateOnFocus: false })

  useEffect(() => {
    if (!serverHealth?.downloadDir || tauri) return
    setDownloadConfig((current) => {
      const next = syncLocalDestinationWithServer(current, serverHealth.downloadDir)
      return next === current ? current : next
    })
  }, [serverHealth?.downloadDir, tauri])

  const activeDestination = useMemo(() => getDestination(downloadConfig), [downloadConfig])
  const activeSecrets = activeDestination ? destinationSecretMap[activeDestination.id] : undefined

  const effectiveDownloadConfig = useMemo(
    () => {
      const jellyfinKey = jellyfinApiKey || downloadConfig.jellyfinApiKey
      if (!activeDestination) {
        return {
          ...downloadConfig,
          sshPassword: sshPassword || downloadConfig.sshPassword,
          jellyfinApiKey: jellyfinKey,
        }
      }
      const secrets = {
        sshPassword: activeSecrets?.sshPassword || sshPassword || downloadConfig.sshPassword,
      }
      return destinationToLegacyConfig(downloadConfig, activeDestination, secrets, jellyfinKey)
    },
    [activeDestination, activeSecrets, downloadConfig, jellyfinApiKey, sshPassword],
  )

  useDownloadPolling({ enabled: tauri, downloadJobs, setDownloadJobs })
  useJellyfinRefresh({ downloadJobs, setDownloadJobs })
  useDownloadNotifications({ enabled: preferences.downloadNotifications, jobs: downloadJobs })
  useDockBadge(downloadJobs)

  useEffect(() => {
    if (!secretsLoaded) return
    const accepted = loadStoredString(STORAGE_KEYS.legalNoticeAccepted, '') === '1'
    setFirstRunOpen(!accepted)
  }, [secretsLoaded])

  useEffect(() => {
    switch (route.modal?.kind) {
      case 'settings':
        setPreferencesTab(route.modal.tab)
        setPreferencesOpen(true)
        setDownloadsOpen(false)
        setFiltersOpen(false)
        setLegalOpen(false)
        break
      case 'downloads':
        setDownloadsOpen(true)
        setPreferencesOpen(false)
        setFiltersOpen(false)
        setLegalOpen(false)
        break
      case 'filters':
        setFiltersOpen(true)
        setPreferencesOpen(false)
        setDownloadsOpen(false)
        setLegalOpen(false)
        break
      case 'legal':
        setLegalOpen(true)
        setPreferencesOpen(false)
        setDownloadsOpen(false)
        setFiltersOpen(false)
        break
      default:
        setPreferencesOpen(false)
        setDownloadsOpen(false)
        setFiltersOpen(false)
        setLegalOpen(false)
        break
    }
  }, [route.modal])

  useEffect(() => {
    if (startupSyncedRef.current) return
    startupSyncedRef.current = true

    const urlRoute = readAppRoute()
    const isDefaultHome =
      window.location.pathname === '/' &&
      !urlRoute.title &&
      !urlRoute.modal &&
      !urlRoute.searchQuery &&
      !urlRoute.presetId

    if (!isDefaultHome) return
    if (urlRoute.catalogId === initialBrowse.catalogId && urlRoute.contentType === initialBrowse.contentType) return

    navigateBrowse(initialBrowse.contentType, initialBrowse.catalogId, true)
  }, [initialBrowse.catalogId, initialBrowse.contentType, navigateBrowse])

  useEffect(() => {
    if (route.contentType !== contentType) setContentType(route.contentType)
    if (route.searchQuery !== undefined) return

    if (route.presetId) {
      const preset = findFilterPresetByRouteSlug(route.presetId, customFilterPresets)
      if (preset) {
        setMovieFilters({ ...preset.filters })
      } else {
        setMovieFilters(defaultMovieFilters)
      }
      if (catalogId !== 'trending') setCatalogId('trending')
      if (query.trim()) setQuery('')
      return
    }

    if (route.catalogId !== catalogId) setCatalogId(route.catalogId)
  }, [route.catalogId, route.contentType, route.presetId, route.searchQuery, catalogId, contentType, customFilterPresets, query])

  useEffect(() => {
    if (!route.title) {
      titleLoadRef.current = null
      return
    }

    const { type, id, season, episode } = route.title
    const key = `${type}:${id}:${season ?? ''}:${episode ?? ''}`

    if (selectedMovie?.id === id && selectedMovie.type === type) {
      if (season != null && selectedSeason !== season) setSelectedSeason(season)
      if (episode != null && selectedEpisode !== episode) setSelectedEpisode(episode)
      return
    }

    const fromLists =
      movies.find((entry) => entry.id === id && entry.type === type) ??
      watchlist.find((entry) => entry.id === id && entry.type === type) ??
      recentViews.find((entry) => entry.id === id && entry.type === type)

    if (fromLists) {
      setSelectedMovie(fromLists)
      setRecentViews(recordRecentView(fromLists))
      if (season != null) setSelectedSeason(season)
      if (episode != null) setSelectedEpisode(episode)
      return
    }

    if (titleLoadRef.current === key) return
    titleLoadRef.current = key

    let cancelled = false
    void loadJson<Record<string, unknown>>(metaUrl(type, id)).then((body) => {
      if (cancelled) return
      const meta = (body.meta ?? body) as Parameters<typeof normalizeCatalogItem>[0]
      const movie = normalizeCatalogItem(meta, type)
      if (!movie) return
      setSelectedMovie(movie)
      setRecentViews(recordRecentView(movie))
      if (season != null) setSelectedSeason(season)
      if (episode != null) setSelectedEpisode(episode)
    })

    return () => {
      cancelled = true
    }
  }, [route.title, movies, watchlist, recentViews, selectedMovie?.id, selectedMovie?.type, selectedSeason, selectedEpisode])

  useEffect(() => {
    if (route.title) return
    if (!selectedMovie) return
    setSelectedMovie(null)
    setPlaybackUrl('')
    setPlaybackError('')
    setPlaybackStatus('')
    setPlaybackDuration(null)
    setPlaybackMediaOffset(0)
  }, [route.title, selectedMovie])

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
    void migrateLegacySecrets(downloadConfig, { jellyfinApiKey, sshPassword }, setJellyfinApiKey)
  }, [downloadConfig.destinations.length, jellyfinApiKey, secretsLoaded, sshPassword])

  useEffect(() => {
    applyThemeMode(preferences.theme)
    saveThemeMode(preferences.theme)
  }, [preferences.theme])

  useEffect(() => {
    if (isLibraryCatalog(catalogId)) {
      setMovieError('')
      setCatalogSkip(0)
      setHasMoreMovies(false)
      setLoadingMoreMovies(false)
      return
    }

    setSelectedSeason(null)
    setSelectedEpisode(null)
    setMovieError('')
    setMovies([])
    setCatalogSkip(0)
    setHasMoreMovies(false)
    setLoadingMoreMovies(false)
  }, [catalogId, contentType, filteredCatalogUrl])

  useEffect(() => {
    if (isLibraryCatalog(catalogId) || catalogLoading || catalogValidating || !catalogData) return
    setMovies(catalogData)
    setCatalogSkip(catalogData.length)
    setHasMoreMovies(catalogSupportsPagination(filteredCatalogUrl) && catalogData.length > 0)
    setMovieError('')
  }, [catalogData, catalogId, catalogLoading, catalogValidating])

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
    if (!preferences.searchHistoryEnabled) return
    if (debouncedQuery.length >= 2) {
      setSearchHistory(recordSearchQuery(debouncedQuery))
    }
  }, [debouncedQuery, preferences.searchHistoryEnabled])
  useEffect(() => { setStreams(streamData?.streams || []); setStreamErrors([...(streamData?.errors || []), ...(streamError ? [streamError instanceof Error ? streamError.message : 'Stream lookup failed'] : [])]) }, [streamData, streamError])
  useEffect(() => {
    if (!serverStatuses) return
    setDownloadJobs((current) => mergeServerDownloadJobs(current, serverStatuses, dismissedDownloadIdsRef.current))
  }, [serverStatuses])
  useEffect(() => { saveStoredJson(STORAGE_KEYS.plugins, plugins); saveStoredJson(STORAGE_KEYS.preferences, preferences); saveStoredJson(STORAGE_KEYS.downloadConfig, downloadConfig); saveStoredJson(STORAGE_KEYS.downloadJobs, downloadJobs); saveStoredJson(STORAGE_KEYS.downloadSort, downloadSort); saveStoredJson(STORAGE_KEYS.layout, layout) }, [downloadConfig, downloadJobs, downloadSort, layout, plugins, preferences])
  useEffect(() => { saveStoredString(STORAGE_KEYS.contentType, contentType) }, [contentType])
  useEffect(() => { saveStoredString(STORAGE_KEYS.lastCatalogId, catalogId) }, [catalogId])
  useEffect(() => {
    setPlaybackProgressConfig({
      minProgressSeconds: preferences.resumeMinSeconds,
      completeRatio: preferences.completeRatioPercent / 100,
      maxEntries: preferences.continueWatchingLimit,
    })
  }, [preferences.completeRatioPercent, preferences.continueWatchingLimit, preferences.resumeMinSeconds])
  useEffect(() => {
    setRecentViewsLimit(preferences.recentViewsLimit)
  }, [preferences.recentViewsLimit])
  useEffect(() => {
    setApiRequestTimeoutSeconds(preferences.apiRequestTimeoutSeconds)
  }, [preferences.apiRequestTimeoutSeconds])
  useEffect(() => {
    if (selectedMovie?.type !== 'series') {
      setSelectedSeason(null)
      setSelectedEpisode(null)
      return
    }
    if (!seriesEpisodes?.length) return

    if (
      route.title?.id === selectedMovie.id &&
      route.title.season != null &&
      route.title.episode != null
    ) {
      setSelectedSeason(route.title.season)
      setSelectedEpisode(route.title.episode)
      return
    }

    const first = seriesEpisodes.find((entry) => entry.season >= 1) ?? seriesEpisodes[0]
    setSelectedSeason(first.season)
    setSelectedEpisode(first.episode)
    navigateToTitle(selectedMovie, first.season, first.episode, true)
  }, [navigateToTitle, route.title, selectedMovie, seriesEpisodes])
  useEffect(() => { setResultProfile(preferences.defaultProfile) }, [preferences.defaultProfile])
  useEffect(() => {
    setResultsExpanded(preferences.expandStreamResultsByDefault)
  }, [preferences.expandStreamResultsByDefault, resultProfile, selectedMovie?.id, selectedSeason, selectedEpisode])

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
    const jellyfinUrl = downloadConfig.jellyfinUrl
    const jellyfinApiKeyValue = jellyfinApiKey || downloadConfig.jellyfinApiKey
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
    downloadConfig.jellyfinApiKey,
    downloadConfig.jellyfinUrl,
    episodeSelection?.episode,
    episodeSelection?.season,
    jellyfinApiKey,
    selectedMovie,
  ])

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false)
  }, [isDesktop])

  const displayedMovies = useMemo(() => {
    const local = query.trim() ? movies.filter((movie) => `${movie.name} ${movie.releaseInfo || ''}`.toLowerCase().includes(query.trim().toLowerCase())) : movies
    const filters = clientFiltersForCatalog(filteredCatalogUrl, catalogId, movieFilters)
    return filterAndSortMovies(shouldRemoteSearch ? (searchData || []) : local, filters)
  }, [catalogId, movies, movieFilters, query, searchData, shouldRemoteSearch])
  const hasActiveSearchOrFilters =
    Boolean(query.trim()) || Object.values(movieFilters).some((value) => value && value !== 'catalog')
  const compactStreams = useMemo(() => {
    const filtered = filterStreamsForProfile(streams, resultProfile, preferences.preferCachedResults, activeCustomProfile)
    const limit = preferences.compactResultsLimit
    return filtered.length ? filtered.slice(0, limit) : streams.slice(0, limit)
  }, [activeCustomProfile, preferences.compactResultsLimit, preferences.preferCachedResults, resultProfile, streams])

  const jellyfinApiKeyValue = jellyfinApiKey || downloadConfig.jellyfinApiKey
  const { libraryMatches } = useJellyfinCatalogStatus({
    enabled: preferences.jellyfinShowLibraryBadges && Boolean(downloadConfig.jellyfinUrl.trim() && jellyfinApiKeyValue.trim()),
    movies: displayedMovies,
    jellyfinUrl: downloadConfig.jellyfinUrl,
    jellyfinApiKey: jellyfinApiKeyValue,
  })

  const refreshCatalog = useCallback(async () => {
    if (shouldRemoteSearch) {
      await mutateSearch()
      return
    }
    if (!isLibraryCatalog(catalogId)) {
      await mutateCatalog()
    }
  }, [catalogId, mutateCatalog, mutateSearch, shouldRemoteSearch])

  const { pullDistance, refreshing: catalogRefreshing, pullRefreshHandlers } = useCatalogPullRefresh({
    enabled: !isDesktop,
    onRefresh: refreshCatalog,
    scrollRef: moviePanelScrollRef,
  })

  const topStreamQuality = compactStreams[0] ? streamTargetQuality(compactStreams[0]) : 0
  const jellyfinItemUrl = jellyfinMatch ? jellyfinPlayUrl(effectiveDownloadConfig.jellyfinUrl, jellyfinMatch.itemId) : ''

  const libraryContentKey = `${contentType}:${catalogId}`
  const catalogContentKey = `${contentType}:${filteredCatalogUrl}`
  const moviesContentKey = shouldRemoteSearch
    ? `${contentType}:search:${debouncedQuery}`
    : route.presetId
      ? `${contentType}:preset:${route.presetId}`
      : isLibraryCatalog(catalogId)
        ? libraryContentKey
        : catalogContentKey
  useEffect(() => {
    setFocusedMovieIndex(0)
  }, [moviesContentKey])
  const moviesLoading = isLibraryCatalog(catalogId)
    ? false
    : shouldRemoteSearch
      ? (searchLoading || (searchValidating && !searchData?.length))
      : catalogLoading || catalogValidating || (!catalogError && !catalogData && !movies.length)
  const catalogFetchFailed =
    !isLibraryCatalog(catalogId) &&
    !shouldRemoteSearch &&
    !catalogLoading &&
    !catalogValidating &&
    !movies.length &&
    Boolean(catalogError)
  const movieErrorMessage =
    (catalogFetchFailed
      ? catalogError instanceof Error
        ? catalogError.message
        : `Could not load ${contentLabelPlural.toLowerCase()}`
      : '') || (movies.length === 0 ? movieError : '')
  const searchErrorMessage = searchError instanceof Error ? searchError.message : searchError ? 'Search failed' : ''
  const streamEmptyMessage = selectedMovie?.type === 'series' && !episodeSelection
      ? 'Choose a season and episode to load streams for this show.'
    : streamErrors.length
      ? `The enabled source did not return usable results. Refresh or try another ${contentLabelSingular.toLowerCase()}.`
      : `No stream results were found for this ${contentLabelSingular.toLowerCase()} from the enabled sources. Try another profile, refresh, or choose another title.`

  const episodeLoadError = seriesMetaError
    ? (seriesMetaError instanceof Error ? seriesMetaError.message : 'Could not load episodes')
    : ''

  useMessageToast(movieErrorMessage, 'error', `Could not load ${contentLabelPlural.toLowerCase()}`)
  useMessageToast(searchErrorMessage, 'warning', 'Search failed')
  const playbackErrorToast = playbackError && !/torbox api key/i.test(playbackError) ? playbackError : ''
  useMessageToast(playbackErrorToast, 'error', 'Playback failed')
  useMessageToast(episodeLoadError, 'error', 'Could not load episodes')
  useErrorListToast(streamErrors)

  function updatePreferences(patch: Partial<AppPreferences>) {
    setPreferences((current) => ({ ...current, ...patch }))
    if (patch.defaultProfile) setResultProfile(patch.defaultProfile)
    if (patch.libraryViewMode) setFocusedMovieIndex(0)
  }

  function clearPresetRoute() {
    if (route.presetId) navigateBrowse(contentType, catalogId, true)
  }

  function handleApplyFilterPreset(preset: FilterPreset) {
    setQuery('')
    navigatePreset(contentType, presetRouteSlug(preset))
  }

  function handleSaveFilterPreset(name: string) {
    const preset = createFilterPreset(name, movieFilters)
    const next = [...customFilterPresets, preset]
    setCustomFilterPresets(next)
    saveCustomFilterPresets(next)
  }

  function handleClearSearchAndFilters() {
    setMovieFilters(defaultMovieFilters)
    setQuery('')
    clearPresetRoute()
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
      setPreferences(normalizePreferences(payload.preferences))
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
      toast.success('Settings imported', 'API keys were not changed.')
    } catch (error) {
      toast.error('Import failed', error instanceof Error ? error.message : 'Could not import settings.')
    }
  }

  function handleClearSearchHistory() {
    clearSearchHistory()
    setSearchHistory([])
    toast.success('Search history cleared')
  }

  function handleResetPanelSizes() {
    setLayout(defaultLayout)
  }

  function handleSearchPerson(name: string) {
    setQuery(name)
    navigateSearch(contentType, name)
    setSearchHistoryOpen(false)
    searchRef.current?.focus()
  }

  function handleContentTypeChange(next: ContentType) {
    if (route.presetId) setMovieFilters(defaultMovieFilters)
    navigateBrowse(next, route.presetId ? 'trending' : catalogId)
  }

  function handleCatalogChange(nextCatalogId: string) {
    if (route.presetId) setMovieFilters(defaultMovieFilters)
    navigateBrowse(contentType, nextCatalogId)
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
    batch?: { batchId?: string; batchLabel?: string; episodeSeason?: number; episodeNumber?: number },
  ) {
    const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
    const id = stream.infoHash?.toLowerCase() ?? `${movie.id}-${episode?.episode ?? 'movie'}-${index}-${Date.now()}`
    const secrets = await loadDestinationSecrets(destination)
    const jellyfinKey = jellyfinApiKey || downloadConfig.jellyfinApiKey
    const pollConfig = buildPollConfig(downloadConfig, destination, secrets, jellyfinKey, movie)
    setDownloadJobs((current) => [
      {
        pendingId: id,
        createdAt: new Date().toISOString(),
        movie,
        stream,
        destinationId: destination.id,
        destinationName: destination.name,
        pollConfig,
        batchId: batch?.batchId,
        batchLabel: batch?.batchLabel,
        episodeSeason: batch?.episodeSeason ?? episode?.season,
        episodeNumber: batch?.episodeNumber ?? episode?.episode,
      },
      ...current,
    ])
    try {
      const sourceUrl = await resolveStreamUrl(torboxApiKey, stream, stream.url?.startsWith('http') && !stream.infoHash ? stream.url : undefined)
      const request = { id, url: sourceUrl, filename: makeDownloadFilename(movie, stream, episode), folderName: makeMovieFolderName(movie, episode) }
      const legacy = destinationToLegacyConfig(downloadConfig, destination, secrets, jellyfinKey)
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
        : await postApi('/api/downloads', {
            ...request,
            ...localPayload(legacy, movie),
            ...serverDownloadJellyfinPayload(legacy, jellyfinKey),
          })
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
          batchId: batch?.batchId,
          batchLabel: batch?.batchLabel,
          episodeSeason: batch?.episodeSeason ?? episode?.season,
          episodeNumber: batch?.episodeNumber ?? episode?.episode,
        },
        ...current.filter((job) => job.pendingId !== id),
      ])
      toast.success('Download started', movie.name)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start download.'
      setDownloadJobs((current) => [
        {
          pendingId: id,
          movie,
          stream,
          destinationId: destination.id,
          destinationName: destination.name,
          pollConfig,
          error: message,
          batchId: batch?.batchId,
          batchLabel: batch?.batchLabel,
          episodeSeason: batch?.episodeSeason ?? episode?.season,
          episodeNumber: batch?.episodeNumber ?? episode?.episode,
        },
        ...current.filter((job) => job.pendingId !== id),
      ])
    } finally {
      setDownloadingStreamKey((current) => (current === key ? '' : current))
    }
  }

  function promptTorboxApiKeyIfNeeded(stream?: StreamResult) {
    if (stream && !streamNeedsTorboxResolve(stream)) return true
    if (torboxApiKey.trim()) return true
    setTorboxKeyPromptOpen(true)
    return false
  }

  async function startDownload(stream: StreamResult, index: number) {
    if (!selectedMovie) return
    if (!promptTorboxApiKeyIfNeeded(stream)) return
    if (jellyfinMatch && topStreamQuality && jellyfinMatch.height && topStreamQuality <= jellyfinMatch.height) {
      if (preferences.jellyfinDuplicateAction === 'block') return
      if (preferences.jellyfinDuplicateAction === 'ask') {
        const proceed = window.confirm(`${selectedMovie.name} already exists in Jellyfin at ${jellyfinMatch.qualityLabel || 'current quality'}. Download anyway?`)
        if (!proceed) return
      }
    }

    const ready = readyDestinations(downloadConfig, tauri)
    if (!ready.length) {
      setPendingDownload({ stream, index })
      setDestinationPickerOpen(true)
      return
    }

    if (preferences.alwaysConfirmDownloadDestination || shouldPromptDestinationPicker(downloadConfig, tauri)) {
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
    if (!currentSourceUrl) {
      setPlaybackUrl('')
      setPlaybackError(playbackUnavailableMessage())
      setPlaybackStatus('')
      return
    }

    if (playbackRecoveryCountRef.current >= 1) {
      setPlaybackUrl('')
      setPlaybackError(lastPlaybackErrorRef.current || 'Playback failed. Try playing again or choose another result.')
      setPlaybackStatus('')
      return
    }

    playbackRecoveryCountRef.current += 1
    const generation = ++playbackGenerationRef.current
    const isDirectPlayback = needsTranscodeFallback(currentSourceUrl, playbackUrl)
    setPlaybackStatus(isDirectPlayback ? 'Transcoding' : 'Retrying playback')
    setPlaybackError('')
    setPlaybackUrl('')
    try {
      let sourceUrl = currentSourceUrl
      if (!isDirectPlayback && activePlaybackStreamRef.current) {
        setPlaybackStatus('Refreshing link')
        sourceUrl = await refreshActiveSourceUrl()
        setCurrentSourceUrl(sourceUrl)
      }
      const result = await startTranscodeWithRefresh(sourceUrl, selectedAudioIndex, selectedSubtitleIndex, 0)
      if (generation !== playbackGenerationRef.current) return
      setPlaybackUrl(resolvePlaybackUrl(result.url))
      setPlaybackDuration(result.duration ?? mediaInfo?.duration ?? null)
      setPlaybackMediaOffset(result.mediaOffset ?? 0)
      setPlaybackStatus('')
    } catch (error) {
      if (generation !== playbackGenerationRef.current) return
      setPlaybackUrl('')
      const message = error instanceof Error ? error.message : playbackUnavailableMessage()
      lastPlaybackErrorRef.current = message
      setPlaybackError(message)
      setPlaybackStatus('')
    }
  }, [currentSourceUrl, playbackUrl, selectedAudioIndex, selectedSubtitleIndex, torboxApiKey])

  async function refreshActiveSourceUrl() {
    const active = activePlaybackStreamRef.current
    if (!active) throw new Error('No active stream to refresh.')
    const directUrl = active.stream.url?.startsWith('http') && !active.stream.infoHash ? active.stream.url : undefined
    return resolveStreamUrl(torboxApiKey, active.stream, directUrl)
  }

  async function startTranscodeWithRefresh(
    sourceUrl: string,
    audioIndex: number | null,
    subtitleIndex: number | null,
    startSeconds = 0,
  ) {
    let url = sourceUrl
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await startHlsTranscode(url, audioIndex, subtitleIndex, startSeconds)
      } catch (error) {
        const canRefresh = attempt === 1 && activePlaybackStreamRef.current && isRetriablePlaybackError(error)
        if (!canRefresh) throw error
        setPlaybackStatus('Refreshing link')
        url = await refreshActiveSourceUrl()
        setCurrentSourceUrl(url)
      }
    }
    throw new Error('Could not start transcoded playback.')
  }

  async function preparePlayback(sourceUrl: string, title: string, audioIndex: number | null, subtitleIndex: number | null, resumeAt: number | null = null) {
    const generation = ++playbackGenerationRef.current
    playbackRecoveryCountRef.current = 0
    setPlaybackStatus('Opening')
    setPlaybackError('')
    setPlaybackUrl('')
    setPlaybackTitle(title)
    setPlaybackStartAt(resumeAt)
    setPlaybackDuration(null)
    setPlaybackMediaOffset(0)
    setSelectedAudioIndex(audioIndex)
    setSelectedSubtitleIndex(subtitleIndex)

    void inspectMedia(sourceUrl).then((info) => {
      if (generation !== playbackGenerationRef.current) return
      setMediaInfo(info)
      if (info?.duration) {
        setPlaybackDuration((current) => current ?? info.duration ?? null)
      }
      if (audioIndex === null && info?.audioTracks[0]?.index !== undefined) {
        setSelectedAudioIndex(info.audioTracks[0].index)
      }
      if (shouldTranscodeDirectly(sourceUrl, audioIndex, subtitleIndex)) {
        setPlaybackStatus(playbackPrepareStatus(info, audioIndex, subtitleIndex))
      }
    })

    if (!shouldTranscodeDirectly(sourceUrl, audioIndex, subtitleIndex)) {
      if (generation !== playbackGenerationRef.current) return
      setPlaybackUrl(resolvePlaybackUrl(sourceUrl))
      setPlaybackDuration(mediaInfo?.duration ?? null)
      setPlaybackMediaOffset(0)
      setPlaybackStatus('')
      return
    }

    setPlaybackStatus('Preparing')
    try {
      const result = await startTranscodeWithRefresh(sourceUrl, audioIndex, subtitleIndex, resumeAt ?? 0)
      if (generation !== playbackGenerationRef.current) return
      setPlaybackUrl(resolvePlaybackUrl(result.url))
      setPlaybackDuration(result.duration ?? mediaInfo?.duration ?? null)
      setPlaybackMediaOffset(result.mediaOffset ?? resumeAt ?? 0)
      setPlaybackStatus('')
    } catch (error) {
      if (generation !== playbackGenerationRef.current) return
      setPlaybackStatus('')
      const message = error instanceof Error ? error.message : 'Could not start transcoded playback.'
      lastPlaybackErrorRef.current = message
      setPlaybackError(message)
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
    const episode = firstEpisode?.episode ?? null
    setSelectedEpisode(episode)
    if (selectedMovie) navigateToTitle(selectedMovie, season, episode, true)
  }

  async function playStream(stream: StreamResult, index: number) {
    if (!selectedMovie) return
    if (!promptTorboxApiKeyIfNeeded(stream)) return
    const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
    activePlaybackStreamRef.current = { stream, index }
    setResolvingStreamKey(key)
    setPlaybackError('')
    setPlaybackStatus('Resolving')
    setPlaybackUrl('')
    setNativePlayback(null)
    setCurrentSourceUrl('')
    setMediaInfo(null)
    setSelectedAudioIndex(null)
    setSelectedSubtitleIndex(null)
    const resumeAt = getPlaybackResumePosition(selectedMovie, episodeSelection?.season, episodeSelection?.episode)
    try {
      const directUrl = streamDirectUrl(stream)
      const sourceUrl = await resolveStreamUrl(torboxApiKey, stream, directUrl)
      const title = `${selectedMovie.name}${episodePlaybackLabel()} - ${stream.pluginName}`
      setCurrentSourceUrl(sourceUrl)
      setPlaybackTitle(title)

      if (isMacTauri() && preferences.useNativeMacPlayer) {
        setPlaybackStatus('Opening native player')
        const result = await openNativePlayer(sourceUrl, title, preferences.macNativePlayer)
        setNativePlayback({ player: result.player, title, mode: result.mode })
        setPlaybackStatus('')
        toast.success(`Playing in ${result.player}`)
        return
      }

      await preparePlayback(sourceUrl, title, null, null, resumeAt)
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not start playback.')
      setPlaybackStatus('')
    } finally {
      setResolvingStreamKey('')
    }
  }

  async function playEmbeddedFromNative() {
    if (!currentSourceUrl) return
    const resumeAt = getPlaybackResumePosition(selectedMovie!, episodeSelection?.season, episodeSelection?.episode)
    setNativePlayback(null)
    await preparePlayback(
      currentSourceUrl,
      playbackTitle || 'Player',
      selectedAudioIndex,
      selectedSubtitleIndex,
      resumeAt,
    )
  }

  const handlePlaybackTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (currentTime >= 2) playbackRecoveryCountRef.current = 0
      if (!selectedMovie) return
      savePlaybackPosition(selectedMovie, currentTime, duration, episodeSelection?.season, episodeSelection?.episode)
    },
    [episodeSelection?.episode, episodeSelection?.season, selectedMovie],
  )

  const proceedToNextEpisode = useCallback(
    (next: { season: number; episode: number }) => {
      if (!selectedMovie) return
      pendingAutoPlayRef.current = true
      setNextEpisodePrompt(null)
      setSelectedSeason(next.season)
      setSelectedEpisode(next.episode)
      navigateToTitle(selectedMovie, next.season, next.episode, true)
      setPlaybackUrl('')
      setPlaybackStatus('Loading next episode')
    },
    [navigateToTitle, selectedMovie],
  )

  const handlePlaybackEnded = useCallback(() => {
    if (!selectedMovie || selectedMovie.type !== 'series' || !preferences.autoPlayNextEpisode || !episodeSelection || !seriesEpisodes?.length) {
      return
    }
    const next = nextEpisode(seriesEpisodes, episodeSelection)
    if (!next) return
    if (preferences.nextEpisodeCountdown > 0) {
      setNextEpisodePrompt({ remaining: preferences.nextEpisodeCountdown, next })
      return
    }
    proceedToNextEpisode(next)
  }, [episodeSelection, preferences.autoPlayNextEpisode, preferences.nextEpisodeCountdown, proceedToNextEpisode, selectedMovie, seriesEpisodes])

  useEffect(() => {
    if (!nextEpisodePrompt) return
    if (nextEpisodePrompt.remaining <= 0) {
      proceedToNextEpisode(nextEpisodePrompt.next)
      return
    }
    const timer = window.setTimeout(() => {
      setNextEpisodePrompt((current) => {
        if (!current) return null
        if (current.remaining <= 1) {
          proceedToNextEpisode(current.next)
          return null
        }
        return { ...current, remaining: current.remaining - 1 }
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [nextEpisodePrompt, proceedToNextEpisode])

  useEffect(() => {
    if (!pendingAutoPlayRef.current || streamsLoading || !compactStreams.length) return
    const stream = compactStreams[0]!
    if (!torboxApiKey.trim() && streamNeedsTorboxResolve(stream)) return
    pendingAutoPlayRef.current = false
    setPlaybackStatus('')
    void playStream(stream, 0)
  }, [compactStreams, streamsLoading, episodeSelection?.episode, episodeSelection?.season, torboxApiKey])

  useEffect(() => {
    autoPlayedStreamKeyRef.current = null
  }, [selectedMovie?.id, selectedSeason, selectedEpisode])

  useEffect(() => {
    if (!preferences.autoPlayResolvedStreams) return
    if (streamsLoading || !compactStreams.length || !selectedMovie) return
    if (pendingAutoPlayRef.current) return
    if (playbackUrl || resolvingStreamKey || playbackStatus) return

    const stream = compactStreams[0]!
    if (!torboxApiKey.trim() && streamNeedsTorboxResolve(stream)) return

    const key = `${selectedMovie.id}:${selectedSeason ?? ''}:${selectedEpisode ?? ''}`
    if (autoPlayedStreamKeyRef.current === key) return

    autoPlayedStreamKeyRef.current = key
    void playStream(stream, 0)
  }, [
    compactStreams,
    playbackStatus,
    playbackUrl,
    preferences.autoPlayResolvedStreams,
    resolvingStreamKey,
    selectedEpisode,
    selectedMovie,
    selectedSeason,
    streamsLoading,
    torboxApiKey,
  ])

  async function downloadSeason() {
    if (!selectedMovie || selectedMovie.type !== 'series' || selectedSeason === null || !seriesEpisodes?.length) return
    if (!promptTorboxApiKeyIfNeeded()) return
    const destination = getDefaultDestination(downloadConfig)
    if (!destination || !readyDestinations(downloadConfig, tauri).some((entry) => entry.id === destination.id)) {
      openSettings('downloads')
      return
    }
    const episodes = seriesEpisodes.filter((entry) => entry.season === selectedSeason)
    if (!episodes.length) return
    const batchId = `season-${selectedMovie.id}-s${selectedSeason}-${Date.now()}`
    const batchLabel = `${selectedMovie.name} · S${selectedSeason}`
    const jellyfinKey = jellyfinApiKey || downloadConfig.jellyfinApiKey
    let ownedEpisodes = new Set<number>()
    if (preferences.jellyfinSkipOwnedEpisodes && downloadConfig.jellyfinUrl.trim() && jellyfinKey.trim()) {
      const owned = await lookupJellyfinSeasonEpisodes({
        baseUrl: downloadConfig.jellyfinUrl,
        apiKey: jellyfinKey,
        imdbId: selectedMovie.id,
        season: selectedSeason,
      })
      ownedEpisodes = new Set(owned.map((entry) => entry.episode))
    }
    setBatchDownloading(true)
    openDownloads()
    let queued = 0
    let skipped = 0
    try {
      for (const entry of episodes) {
        if (ownedEpisodes.has(entry.episode)) {
          skipped += 1
          continue
        }
        const urlResults = await Promise.allSettled(
          activePlugins.map(async (plugin) => {
            const url = hydrateUrl(plugin.streamUrlTemplate, selectedMovie, torboxApiKey, 'series', { season: entry.season, episode: entry.episode })
            return normalizeStreams(plugin.name, await loadJson<unknown>(url))
          }),
        )
        const found = urlResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
        const best = filterStreamsForProfile(found.sort((a, b) => b.rank - a.rank), resultProfile, preferences.preferCachedResults, activeCustomProfile)[0]
        if (best) {
          await queueDownload(
            best,
            entry.episode,
            selectedMovie,
            { season: entry.season, episode: entry.episode },
            destination,
            { batchId, batchLabel, episodeSeason: entry.season, episodeNumber: entry.episode },
          )
          queued += 1
        }
      }
      const detail = skipped
        ? `${queued} queued, ${skipped} skipped (already in Jellyfin)`
        : `Season ${selectedSeason} downloads added to the queue.`
      toast.success('Season queued', detail)
    } finally {
      setBatchDownloading(false)
    }
  }

  async function retryDownloadJob(job: DownloadJob) {
    const destination = job.destinationId
      ? downloadConfig.destinations.find((entry) => entry.id === job.destinationId)
      : getDefaultDestination(downloadConfig)
    if (!destination) {
      toast.error('Could not retry download', 'No destination configured.')
      return
    }
    markDownloadDismissed(dismissedDownloadIdsRef.current, job)
    setDownloadJobs((current) => current.filter((item) => !isDownloadDismissed(item, dismissedDownloadIdsRef.current)))
    const episode = job.episodeSeason != null && job.episodeNumber != null
      ? { season: job.episodeSeason, episode: job.episodeNumber }
      : undefined
    await queueDownload(job.stream, job.episodeNumber ?? 0, job.movie, episode, destination, {
      batchId: job.batchId,
      batchLabel: job.batchLabel,
      episodeSeason: job.episodeSeason,
      episodeNumber: job.episodeNumber,
    })
  }

  async function handleImportJellyfinWatchlist() {
    const jellyfinKey = jellyfinApiKey || downloadConfig.jellyfinApiKey
    if (!downloadConfig.jellyfinUrl.trim() || !jellyfinKey.trim()) {
      toast.error('Jellyfin not configured', 'Add your Jellyfin URL and API key first.')
      return
    }
    try {
      const favorites = await fetchJellyfinFavorites({
        baseUrl: downloadConfig.jellyfinUrl,
        apiKey: jellyfinKey,
      })
      if (!favorites.length) {
        toast.info('No favorites found', 'Jellyfin returned no favorite movies or shows.')
        return
      }
      setWatchlist(mergeWatchlist(favorites))
      toast.success('Watchlist updated', `${favorites.length} favorites imported from Jellyfin.`)
    } catch (error) {
      toast.error('Import failed', error instanceof Error ? error.message : 'Could not import Jellyfin favorites.')
    }
  }

  function handleOpenInJellyfin() {
    if (!jellyfinItemUrl) return
    window.open(jellyfinItemUrl, '_blank', 'noopener,noreferrer')
  }

  function dismissFirstRun() {
    if (!firstRunLegalAccepted) return
    saveStoredString(STORAGE_KEYS.legalNoticeAccepted, '1')
    saveStoredString('torfin:first-run-dismissed', '1')
    setFirstRunOpen(false)
  }

  async function deleteDownloadOnServer(job: DownloadJob) {
    const id = downloadJobKey(job)
    if (!id) return
    if (tauri) {
      const mode = job.pollConfig?.mode
      await import('@tauri-apps/api/core').then(({ invoke }) => {
        if (mode === 'local') return invoke('cancel_local_url_download', { id })
        return invoke('cancel_remote_url_download', { id })
      })
      return
    }
    const response = await fetch(`/api/downloads/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Could not remove download from server.')
  }

  async function cancelDownloadJob(job: DownloadJob) {
    const id = downloadJobKey(job)
    const name = job.movie.name
    markDownloadDismissed(dismissedDownloadIdsRef.current, job)
    setDownloadJobs((current) => current.filter((item) => !isDownloadDismissed(item, dismissedDownloadIdsRef.current)))
    toast.info('Download removed', name)
    if (!id) return
    try {
      await deleteDownloadOnServer(job)
    } catch {
      toast.error('Could not remove download on server', name)
    }
  }

  async function clearFinishedDownloads() {
    const finished = downloadJobs.filter((job) => job.status?.complete || job.status?.state.startsWith('error:') || job.error)
    const count = finished.length
    if (!count) return
    for (const job of finished) markDownloadDismissed(dismissedDownloadIdsRef.current, job)
    setDownloadJobs((current) => current.filter((job) => !isDownloadDismissed(job, dismissedDownloadIdsRef.current)))
    toast.info('Cleared finished downloads', `${count} ${count === 1 ? 'item' : 'items'} removed`)
    await Promise.allSettled(finished.map((job) => deleteDownloadOnServer(job)))
  }

  async function pauseDownloadJob(job: DownloadJob) {
    const id = downloadJobKey(job)
    if (!id) return
    setDownloadJobs((current) =>
      current.map((entry) => (downloadJobKey(entry) === id ? { ...entry, paused: true } : entry)),
    )
    try {
      if (tauri) {
        const mode = job.pollConfig?.mode
        if (mode === 'local') {
          await import('@tauri-apps/api/core').then(({ invoke }) => invoke('pause_local_url_download', { id }))
        }
      } else {
        await postApi(`/api/downloads/${encodeURIComponent(id)}/pause`, {})
      }
    } catch {
      setDownloadJobs((current) =>
        current.map((entry) => (downloadJobKey(entry) === id ? { ...entry, paused: false } : entry)),
      )
      toast.error('Could not pause download', job.movie.name)
    }
  }

  async function resumeDownloadJob(job: DownloadJob) {
    const id = downloadJobKey(job)
    if (!id) return
    setDownloadJobs((current) =>
      current.map((entry) => (downloadJobKey(entry) === id ? { ...entry, paused: false } : entry)),
    )
    try {
      if (tauri) {
        const mode = job.pollConfig?.mode
        if (mode === 'local') {
          await import('@tauri-apps/api/core').then(({ invoke }) => invoke('resume_local_url_download', { id }))
        }
      } else {
        await postApi(`/api/downloads/${encodeURIComponent(id)}/resume`, {})
      }
    } catch {
      setDownloadJobs((current) =>
        current.map((entry) => (downloadJobKey(entry) === id ? { ...entry, paused: true } : entry)),
      )
      toast.error('Could not resume download', job.movie.name)
    }
  }

  function handleToggleWatchlist(movie: Movie) {
    const next = toggleWatchlist(movie)
    setWatchlist(next)
    const added = next.some((entry) => entry.id === movie.id && entry.type === movie.type)
    toast.success(added ? 'Added to watchlist' : 'Removed from watchlist', movie.name)
  }

  function handleFocusMovie(movie: Movie) {
    setFocusedMovieIndex(
      displayedMovies.findIndex((entry) => entry.id === movie.id && entry.type === movie.type),
    )
  }

  function handleSelectMovie(movie: Movie) {
    navigateToTitle(movie)
    setSelectedMovie(movie)
    setRecentViews(recordRecentView(movie))
    handleFocusMovie(movie)
    if (!isDesktop) setSidebarOpen(false)
  }

  function handleCloseInspector() {
    closeTitle()
    setPlaybackUrl('')
    setPlaybackError('')
    setPlaybackStatus('')
    setPlaybackDuration(null)
    setPlaybackMediaOffset(0)
    setNextEpisodePrompt(null)
  }

  function handleEpisodeChange(episode: number) {
    setSelectedEpisode(episode)
    if (selectedMovie && selectedSeason !== null) {
      navigateToTitle(selectedMovie, selectedSeason, episode, true)
    }
  }

  useAppFocusNavigation({
    isDesktop,
    displayedMovies,
    focusedMovieIndex,
    setFocusedMovieIndex,
    catalogScrollRef: moviePanelScrollRef,
    onFocusMovie: handleFocusMovie,
    onSelectMovie: handleSelectMovie,
    onFocusSearch: () => searchRef.current?.focus(),
    onOpenSettings: () => openSettings('general'),
    onOpenShortcuts: () => setShortcutsOpen(true),
    onPlayTopStream: () => {
      if (compactStreams[0]) void playStream(compactStreams[0], 0)
    },
    onDismissOverlay: () => {
      if (torboxKeyPromptOpen) {
        setTorboxKeyPromptOpen(false)
        return
      }
      if (firstRunOpen) {
        if (firstRunLegalAccepted) dismissFirstRun()
        return
      }
      if (destinationPickerOpen) {
        setDestinationPickerOpen(false)
        setPendingDownload(null)
        setDownloadingStreamKey('')
        return
      }
      if (
        filtersOpen ||
        downloadsOpen ||
        preferencesOpen ||
        legalOpen ||
        jellyfinSignInOpen ||
        confirmRemove ||
        shortcutsOpen
      ) {
        setJellyfinSignInOpen(false)
        setConfirmRemove(null)
        setShortcutsOpen(false)
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
    if (shouldRemoteSearch || loadingMoreMovies || !hasMoreMovies || catalogError || catalogSkip <= 0) return
    setLoadingMoreMovies(true)
    try {
      const body = await loadJson<{ metas?: unknown[] }>(catalogPageUrl(filteredCatalogUrl, catalogSkip))
      const incoming = (body.metas || []).map((item) => normalizeCatalogItem(item as never, contentType)).filter(Boolean) as Movie[]
      setMovies((current) => appendUniqueMovies(current, incoming))
      setCatalogSkip((current) => current + incoming.length)
      setHasMoreMovies(incoming.length > 0)
      setMovieError('')
    } catch (error) {
      if (isCatalogEndError(error)) {
        setHasMoreMovies(false)
      } else {
        setMovieError(error instanceof Error ? error.message : 'Could not load more movies')
      }
    } finally {
      setLoadingMoreMovies(false)
    }
  }, [catalogError, catalogSkip, contentType, filteredCatalogUrl, hasMoreMovies, loadingMoreMovies, shouldRemoteSearch])

  useCatalogScrollLoad({
    scrollRef: moviePanelScrollRef,
    loadMoreRef,
    loadNextPage,
    enabled: !shouldRemoteSearch && hasMoreMovies && !moviesLoading && !loadingMoreMovies && !catalogError && catalogSkip > 0,
    itemCount: displayedMovies.length,
    layoutKey: preferences.libraryViewMode,
  })

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
    <main className="app-viewport overflow-hidden bg-[var(--mac-window)] text-[var(--mac-text)]">
      <div className="app-shell grid h-full" style={shellStyle}>
        {/* Desktop sidebar (in grid) */}
        {isDesktop ? (
          <Sidebar
            contentType={contentType}
            catalogId={catalogId}
            watchlistCount={watchlist.length}
            continueCount={continueWatchingMovies().length}
            recentCount={recentViews.length}
            preferencesOpen={preferencesOpen}
            downloadsOpen={downloadsOpen}
            legalOpen={legalOpen}
            downloadSummary={downloadSummary}
            onContentTypeChange={handleContentTypeChange}
            onCatalogChange={handleCatalogChange}
            onOpenPreferences={() => openSettings('general')}
            onOpenDownloads={openDownloads}
            onOpenLegal={openLegal}
            customFilterPresets={customFilterPresets}
            activePresetId={route.presetId}
            movieFilters={movieFilters}
            onApplyFilterPreset={handleApplyFilterPreset}
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
            watchlistCount={watchlist.length}
            continueCount={continueWatchingMovies().length}
            recentCount={recentViews.length}
            preferencesOpen={preferencesOpen}
            downloadsOpen={downloadsOpen}
            legalOpen={legalOpen}
            downloadSummary={downloadSummary}
            onContentTypeChange={handleContentTypeChange}
            onCatalogChange={handleCatalogChange}
            onOpenPreferences={() => openSettings('general')}
            onOpenDownloads={openDownloads}
            onOpenLegal={openLegal}
            customFilterPresets={customFilterPresets}
            activePresetId={route.presetId}
            movieFilters={movieFilters}
            onApplyFilterPreset={handleApplyFilterPreset}
          />
        ) : null}

        <button
          type="button"
          className="app-splitter app-splitter-left"
          data-focus-ignore
          onPointerDown={(event) => startSidebarResize('left', event)}
          aria-label="Resize library sidebar"
          aria-orientation="vertical"
        />

        <section className="relative flex min-h-0 min-w-0 flex-col">
          <FocusZone
            zone="toolbar"
            className="mac-toolbar app-mobile-toolbar flex h-14 shrink-0 items-center gap-2 border-b border-[var(--mac-divider,var(--mac-border))] px-3 sm:gap-3 sm:px-4"
          >
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
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold tracking-normal">{browseTitle}</h2>
                <p className="text-[11px] text-[var(--mac-secondary)] transition-opacity duration-150">
                  {moviesLoading ? 'Loading…' : `${displayedMovies.length} ${displayedMovies.length === 1 ? contentLabelSingular : contentLabelPlural}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => updatePreferences({ libraryViewMode: preferences.libraryViewMode === 'grid' ? 'list' : 'grid' })}
                className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] transition hover:bg-[var(--mac-control-hover)]"
                title={preferences.libraryViewMode === 'grid' ? 'List view' : 'Grid view'}
              >
                {preferences.libraryViewMode === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
              </button>
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
                className="h-8 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] pl-8 pr-2 text-[13px] outline-none transition placeholder:text-[var(--mac-tertiary)] focus:border-[color-mix(in_srgb,var(--mac-accent)_40%,var(--mac-border))] focus:ring-2 focus:ring-[var(--mac-accent-soft)]"
              />
              {searchHistoryOpen && preferences.searchHistoryEnabled && searchHistory.length && !query.trim() ? (
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
              onClick={openFilters}
              className={`grid size-8 place-items-center rounded-md border border-[var(--mac-border)] transition hover:bg-[var(--mac-control-hover)] ${
                Object.values(movieFilters).some((value) => value && value !== 'catalog')
                  ? 'bg-[var(--mac-accent-soft)] text-[var(--mac-accent-soft-text)]'
                  : 'bg-[var(--mac-control)]'
              }`}
              title="Filters"
            >
              <SlidersHorizontal size={16} />
            </button>
          </FocusZone>

          {!isDesktop && (pullDistance > 0 || catalogRefreshing) ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center py-2 text-[11px] font-medium text-[var(--mac-secondary)]"
              style={{ transform: `translateY(${Math.min(pullDistance, 48)}px)` }}
            >
              {catalogRefreshing ? 'Refreshing catalog…' : pullDistance >= 48 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          ) : null}

          {preferences.libraryViewMode === 'list' ? (
            <MovieList
              movies={displayedMovies}
              selectedMovieId={selectedMovie?.id}
              focusedMovieIndex={focusedMovieIndex}
              catalogId={catalogId}
              contentKey={moviesContentKey}
              watchlistIds={watchlistIds}
              libraryMatches={libraryMatches}
              showYears={preferences.showYears}
              showRatings={preferences.showRatings}
              loading={moviesLoading}
              loadingMore={loadingMoreMovies}
              hasMoreMovies={hasMoreMovies}
              shouldRemoteSearch={shouldRemoteSearch}
              scrollRef={moviePanelScrollRef}
              loadMoreRef={loadMoreRef}
              pullRefreshHandlers={pullRefreshHandlers}
              onSelectMovie={handleSelectMovie}
              onToggleWatchlist={handleToggleWatchlist}
              onClearFilters={hasActiveSearchOrFilters ? handleClearSearchAndFilters : undefined}
              onOpenSettings={() => openSettings('general')}
              onBrowseTrending={() => navigateBrowse(contentType, 'trending')}
            />
          ) : (
            <MovieGrid
              movies={displayedMovies}
              selectedMovieId={selectedMovie?.id}
              focusedMovieIndex={focusedMovieIndex}
              catalogId={catalogId}
              contentKey={moviesContentKey}
              watchlistIds={watchlistIds}
              libraryMatches={libraryMatches}
              posterSize={preferences.posterSize}
              showYears={preferences.showYears}
              showRatings={preferences.showRatings}
              loading={moviesLoading}
              loadingMore={loadingMoreMovies}
              hasMoreMovies={hasMoreMovies}
              shouldRemoteSearch={shouldRemoteSearch}
              scrollRef={moviePanelScrollRef}
              loadMoreRef={loadMoreRef}
              pullRefreshHandlers={pullRefreshHandlers}
              onSelectMovie={handleSelectMovie}
              onToggleWatchlist={handleToggleWatchlist}
              onClearFilters={hasActiveSearchOrFilters ? handleClearSearchAndFilters : undefined}
              onOpenSettings={() => openSettings('general')}
              onBrowseTrending={() => navigateBrowse(contentType, 'trending')}
            />
          )}
        </section>

        <button
          type="button"
          className="app-splitter app-splitter-right max-lg:hidden"
          data-focus-ignore
          onPointerDown={(event) => startSidebarResize('right', event)}
          aria-label="Resize movie details sidebar"
          aria-orientation="vertical"
        />

        <InspectorPanel
          contentType={contentType}
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
          jellyfinUrl={effectiveDownloadConfig.jellyfinUrl}
          jellyfinItemUrl={jellyfinItemUrl}
          onOpenInJellyfin={jellyfinItemUrl ? handleOpenInJellyfin : undefined}
          topStreamQuality={topStreamQuality}
          episodeOptions={seriesEpisodes || []}
          loadingEpisodes={seriesMetaLoading}
          episodeLoadError={episodeLoadError}
          selectedSeason={selectedSeason}
          selectedEpisode={selectedEpisode}
          onSeasonChange={handleSeasonChange}
          onEpisodeChange={handleEpisodeChange}
          onDownloadSeason={() => { void downloadSeason() }}
          batchDownloading={batchDownloading}
          streams={streams}
          compactStreams={compactStreams}
          profileOptions={profileOptions}
          loadingStreams={streamsLoading}
          showStreamResults={showStreamResults}
          streamEmptyMessage={streamEmptyMessage}
          resultProfile={resultProfile}
          resultsExpanded={resultsExpanded}
          playbackUrl={playbackUrl}
          playbackTitle={playbackTitle}
          playbackStatus={playbackStatus}
          nativePlayback={nativePlayback}
          onPlayEmbedded={() => { void playEmbeddedFromNative() }}
          playbackStartAt={playbackStartAt}
          playbackDuration={playbackDuration}
          playbackMediaOffset={playbackMediaOffset}
          onPlaybackMediaOffsetChange={setPlaybackMediaOffset}
          mediaInfo={mediaInfo}
          selectedAudioIndex={selectedAudioIndex}
          selectedSubtitleIndex={selectedSubtitleIndex}
          onPlaybackError={handlePlaybackFailure}
          onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
          onPlaybackEnded={handlePlaybackEnded}
          nextEpisodePrompt={nextEpisodePrompt}
          onCancelNextEpisode={() => setNextEpisodePrompt(null)}
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
          onClose={closeModal}
          onChange={(next) => {
            setMovieFilters(next)
            clearPresetRoute()
          }}
          onReset={() => {
            setMovieFilters(defaultMovieFilters)
            clearPresetRoute()
          }}
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
          onClearFinished={() => { void clearFinishedDownloads() }}
          onRemoveJob={setConfirmRemove}
          onPauseJob={pauseDownloadJob}
          onResumeJob={resumeDownloadJob}
          onRetryJob={(job) => { void retryDownloadJob(job) }}
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
          jellyfinApiKey={jellyfinApiKey}
          onClose={closeModal}
          onTabChange={setSettingsTab}
          onUpdatePlugin={(pluginId, patch) => setPlugins((current) => current.map((plugin) => (plugin.id === pluginId ? { ...plugin, ...patch } : plugin)))}
          onUpdatePreferences={updatePreferences}
          onUpdateDownloadConfig={updateDownloadConfig}
          onChangeTorboxApiKey={setTorboxApiKey}
          onChangeJellyfinApiKey={setJellyfinApiKey}
          onOpenJellyfinSignIn={openJellyfinSignIn}
          onImportJellyfinWatchlist={() => { void handleImportJellyfinWatchlist() }}
          onExportSettings={handleExportSettings}
          onImportSettings={handleImportSettings}
          onClearSearchHistory={handleClearSearchHistory}
          onResetPanelSizes={handleResetPanelSizes}
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
              toast.success('Signed in to Jellyfin')
            } catch (error) {
              toast.error('Jellyfin sign-in failed', error instanceof Error ? error.message : 'Could not sign in to Jellyfin.')
            }
          }}
        />
        <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <LegalNoticeModal open={legalOpen} onClose={closeModal} />
        <FirstRunSetup
          open={firstRunOpen}
          legalAccepted={firstRunLegalAccepted}
          onChangeLegalAccepted={setFirstRunLegalAccepted}
          onOpenLegal={openLegal}
          onDismiss={dismissFirstRun}
        />
      <ConfirmationDialog
        open={torboxKeyPromptOpen}
        title="Torbox API key required"
        message="Playing and downloading need a Torbox API key to resolve streams. Add your key in Settings → Accounts to continue."
        confirmLabel="Open Settings"
        confirmTone="primary"
        onCancel={() => setTorboxKeyPromptOpen(false)}
        onConfirm={() => {
          setTorboxKeyPromptOpen(false)
          openSettings('integrations')
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
