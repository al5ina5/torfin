import { LayoutGrid, List, Menu, Search, SlidersHorizontal } from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'

import { ConfirmationDialog } from './components/ConfirmationDialog'
import { DownloadsModal } from './components/DownloadsModal'
import { FiltersModal } from './components/FiltersModal'
import { InspectorPanel } from './components/InspectorPanel'
import { JellyfinSignInModal } from './components/JellyfinSignInModal'
import { MovieGrid } from './components/MovieGrid'
import { MovieList } from './components/MovieList'
import { PreferencesModal } from './components/PreferencesModal'
import { Sidebar } from './components/Sidebar'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useDockBadge } from './hooks/useDockBadge'
import { useDownloadNotifications } from './hooks/useDownloadNotifications'
import { loadServerDownloads, useDownloadPolling } from './hooks/useDownloadPolling'
import { useJellyfinRefresh } from './hooks/useJellyfinRefresh'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useSecrets } from './hooks/useSecrets'
import { isTauriRuntime, loadJson, postApi, resolveStreamUrl } from './lib/api'
import { catalogPageUrl, enrichMovieFromMeta, metaUrl, normalizeCatalogItem, normalizeSeriesEpisodes, similarMoviesFromMeta, searchUrl } from './lib/cinemeta'
import { allProfileOptions, findCustomProfile } from './lib/custom-profiles'
import { allFilterPresets, createFilterPreset, loadCustomFilterPresets, saveCustomFilterPresets } from './lib/filter-presets'
import {
  defaultDownloadConfig,
  dedupeDownloadJobs,
  localPayload,
  makeDownloadFilename,
  makeMovieFolderName,
  mergeServerDownloadJobs,
  qbittorrentPayload,
  sshPayload,
  withDownloadTimestamp,
} from './lib/downloads'
import { appendUniqueMovies, catalogOptions, catalogUrlMap, catalogUrlWithFilters, defaultMovieFilters, effectiveMovieFilters, filterAndSortMovies, isLibraryCatalog, libraryCatalogOptions } from './lib/movies'
import { clearSearchHistory, loadRecentViews, loadSearchHistory, recordRecentView, recordSearchQuery } from './lib/history'
import { hydrateUrl, loadSavedPlugins, pluginNeedsTorboxKey } from './lib/plugins'
import { buildSettingsExport, downloadSettingsFile, parseSettingsExport } from './lib/settings-export'
import { applyThemeMode, loadThemeMode, saveThemeMode } from './lib/theme'
import { getPlaybackResumePosition, nextEpisode, savePlaybackPosition, continueWatchingMovies } from './lib/playback-progress'
import { inspectMedia, needsTranscodeFallback, startHlsTranscode } from './lib/playback'
import { jellyfinPlayUrl, lookupJellyfinLibrary, streamTargetQuality } from './lib/jellyfin-library'
import { filterStreamsForProfile, normalizeStreams } from './lib/streams'
import { STORAGE_KEYS, loadStoredJson, loadStoredString, saveStoredJson, saveStoredString } from './lib/storage'
import { isInWatchlist, loadWatchlist, toggleWatchlist } from './lib/watchlist'
import type {
  AppPreferences,
  ContentType,
  DownloadConfig,
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

const resultProfiles: Array<{ id: ResultProfile; label: string; description: string }> = [
  { id: 'netflix', label: 'Netflix', description: 'Clean instant-play picks, one best link per resolution.' },
  { id: 'dataSaver', label: 'Data Saver', description: 'Caps at 1080p and prefers smaller files.' },
  { id: 'cinephile', label: 'Cinephile', description: 'Quality-first picks for 4K, HDR, Remux, and Blu-ray.' },
]

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
  const [downloadConfig, setDownloadConfig] = useState<DownloadConfig>(loadStoredJson(STORAGE_KEYS.downloadConfig, defaultDownloadConfig))
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
  const [serviceStatus, setServiceStatus] = useState('')
  const [serviceError, setServiceError] = useState('')
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

  const { torboxApiKey, jellyfinApiKey, sshPassword, setTorboxApiKey, setJellyfinApiKey, setSshPassword } = useSecrets()
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

  const effectiveDownloadConfig = useMemo(
    () => ({
      ...downloadConfig,
      sshPassword: sshPassword || downloadConfig.sshPassword,
      jellyfinApiKey: jellyfinApiKey || downloadConfig.jellyfinApiKey,
    }),
    [downloadConfig, jellyfinApiKey, sshPassword],
  )

  useDownloadPolling({ enabled: tauri, downloadConfig: effectiveDownloadConfig, downloadJobs, setDownloadJobs })
  useJellyfinRefresh({ downloadConfig: effectiveDownloadConfig, downloadJobs, setDownloadJobs })
  useDownloadNotifications({ enabled: preferences.downloadNotifications, jobs: downloadJobs })
  useDockBadge(downloadJobs)

  useEffect(() => {
    applyThemeMode(preferences.theme)
    saveThemeMode(preferences.theme)
  }, [preferences.theme])

  useEffect(() => {
    if (isLibraryCatalog(catalogId)) {
      setSelectedMovie(null)
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
  }, [catalogData, catalogId, contentType, filteredCatalogUrl, recentViews, watchlist])
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
    if (!selectedMovie || !effectiveDownloadConfig.jellyfinUrl.trim() || !effectiveDownloadConfig.jellyfinApiKey.trim()) {
      setJellyfinMatch(null)
      return
    }
    let cancelled = false
    setJellyfinLoading(true)
    void lookupJellyfinLibrary({
      baseUrl: effectiveDownloadConfig.jellyfinUrl,
      apiKey: effectiveDownloadConfig.jellyfinApiKey,
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
  }, [effectiveDownloadConfig.jellyfinApiKey, effectiveDownloadConfig.jellyfinUrl, episodeSelection?.episode, episodeSelection?.season, selectedMovie])

  useEffect(() => {
    const modalOpen = filtersOpen || downloadsOpen || preferencesOpen || jellyfinSignInOpen || Boolean(confirmRemove)
    const mobileOverlayOpen = !isDesktop && (sidebarOpen || Boolean(selectedMovie))
    document.body.classList.toggle('modal-open', modalOpen || mobileOverlayOpen)
    return () => document.body.classList.remove('modal-open')
  }, [confirmRemove, downloadsOpen, filtersOpen, isDesktop, jellyfinSignInOpen, preferencesOpen, selectedMovie, sidebarOpen])

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
    setFiltersOpen(false)
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
      setDownloadConfig((current) => ({
        ...current,
        ...payload.downloadConfig,
        jellyfinApiKey: current.jellyfinApiKey,
        sshPassword: current.sshPassword,
      }))
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

  function updateDownloadConfig(patch: Partial<DownloadConfig>) {
    if (patch.sshPassword !== undefined) setSshPassword(patch.sshPassword)
    setDownloadConfig((current) => ({ ...current, ...patch }))
  }

  const handlePlaybackFailure = useCallback(async () => {
    if (!needsTranscodeFallback(currentSourceUrl, playbackUrl)) {
      setPlaybackUrl('')
      setPlaybackError('This stream is not playable. Try another result.')
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

    if (audioIndex === null && subtitleIndex === null) {
      setPlaybackUrl(sourceUrl)
      setPlaybackStatus('')
      return
    }

    setPlaybackStatus('Preparing')
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

  async function queueDownload(stream: StreamResult, index: number, movie: Movie, episode?: { season: number; episode: number }) {
    const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
    const id = stream.infoHash?.toLowerCase() ?? `${movie.id}-${episode?.episode ?? 'movie'}-${index}-${Date.now()}`
    setDownloadJobs((current) => [{ pendingId: id, createdAt: new Date().toISOString(), movie, stream }, ...current])
    try {
      const sourceUrl = await resolveStreamUrl(torboxApiKey, stream, stream.url?.startsWith('http') && !stream.infoHash ? stream.url : undefined)
      const request = { id, url: sourceUrl, filename: makeDownloadFilename(movie, stream, episode), folderName: makeMovieFolderName(movie, episode) }
      const status = tauri
        ? await import('@tauri-apps/api/core').then(({ invoke }) => downloadConfig.downloader === 'qbittorrent'
          ? invoke('start_qbittorrent_download', { config: qbittorrentPayload(downloadConfig), request: { id, infoHash: null, magnetUrl: null, directUrl: sourceUrl, name: request.filename } })
          : invoke('start_remote_url_download', { config: sshPayload(effectiveDownloadConfig, movie), request }))
        : await postApi('/api/downloads', { ...request, ...localPayload(downloadConfig, movie) })
      setDownloadJobs((current) => [{ pendingId: id, movie, stream, sourceUrl, status: status as never }, ...current.filter((job) => job.pendingId !== id)])
    } catch (error) {
      setDownloadJobs((current) => [{ pendingId: id, movie, stream, error: error instanceof Error ? error.message : 'Could not start download.' }, ...current.filter((job) => job.pendingId !== id)])
    } finally {
      setDownloadingStreamKey((current) => (current === key ? '' : current))
    }
  }

  async function startDownload(stream: StreamResult, index: number) {
    if (!selectedMovie) return
    if (jellyfinMatch && topStreamQuality && jellyfinMatch.height && topStreamQuality <= jellyfinMatch.height) {
      const proceed = window.confirm(`${selectedMovie.name} already exists in Jellyfin at ${jellyfinMatch.qualityLabel || 'current quality'}. Download anyway?`)
      if (!proceed) return
    }
    const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
    setDownloadingStreamKey(key)
    setDownloadsOpen(true)
    await queueDownload(stream, index, selectedMovie, episodeSelection)
  }

  async function downloadSeason() {
    if (!selectedMovie || selectedMovie.type !== 'series' || selectedSeason === null || !seriesEpisodes?.length) return
    const episodes = seriesEpisodes.filter((entry) => entry.season === selectedSeason)
    if (!episodes.length) return
    setBatchDownloading(true)
    setDownloadsOpen(true)
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
        if (best) await queueDownload(best, entry.episode, selectedMovie, { season: entry.season, episode: entry.episode })
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
      await import('@tauri-apps/api/core').then(({ invoke }) => invoke('cancel_remote_url_download', { id })).catch(() => undefined)
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
    modalOpen: filtersOpen || downloadsOpen || preferencesOpen || jellyfinSignInOpen || Boolean(confirmRemove),
    displayedMovies,
    focusedMovieIndex,
    setFocusedMovieIndex,
    onSelectMovie: handleSelectMovie,
    onFocusSearch: () => searchRef.current?.focus(),
    onOpenSettings: () => setPreferencesOpen(true),
    onPlayTopStream: () => {
      if (compactStreams[0]) void playStream(compactStreams[0], 0)
    },
    onCloseModals: () => {
      if (filtersOpen || downloadsOpen || preferencesOpen || jellyfinSignInOpen || confirmRemove) {
        setFiltersOpen(false)
        setDownloadsOpen(false)
        setDownloadSortOpen(false)
        setPreferencesOpen(false)
        setJellyfinSignInOpen(false)
        setConfirmRemove(null)
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
            onContentTypeChange={setContentType}
            onCatalogChange={setCatalogId}
            onOpenPreferences={() => setPreferencesOpen(true)}
            onOpenDownloads={() => setDownloadsOpen(true)}
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
            onContentTypeChange={setContentType}
            onCatalogChange={setCatalogId}
            onOpenPreferences={() => setPreferencesOpen(true)}
            onOpenDownloads={() => setDownloadsOpen(true)}
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
              onClick={() => setFiltersOpen(true)}
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
          onClose={() => setFiltersOpen(false)}
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
          onClose={() => { setDownloadsOpen(false); setDownloadSortOpen(false) }}
          onSortOpen={setDownloadSortOpen}
          onSortChange={setDownloadSort}
          onClearFinished={() => setDownloadJobs((current) => current.filter((job) => !(job.status?.complete || job.status?.state.startsWith('error:') || job.error)))}
          onRemoveJob={setConfirmRemove}
          onPauseJob={pauseDownloadJob}
          onResumeJob={resumeDownloadJob}
        />
        <PreferencesModal
          open={preferencesOpen}
          tab={preferencesTab}
          plugins={plugins}
          resultProfiles={resultProfiles}
          preferences={preferences}
          downloadConfig={effectiveDownloadConfig}
          torboxApiKey={torboxApiKey}
          jellyfinApiKey={effectiveDownloadConfig.jellyfinApiKey}
          serviceStatus={serviceStatus}
          serviceError={serviceError}
          onClose={() => setPreferencesOpen(false)}
          onTabChange={setPreferencesTab}
          onUpdatePlugin={(pluginId, patch) => setPlugins((current) => current.map((plugin) => (plugin.id === pluginId ? { ...plugin, ...patch } : plugin)))}
          onUpdatePreferences={updatePreferences}
          onUpdateDownloadConfig={updateDownloadConfig}
          onChangeTorboxApiKey={setTorboxApiKey}
          onChangeJellyfinApiKey={setJellyfinApiKey}
          onOpenJellyfinSignIn={() => setJellyfinSignInOpen(true)}
          onTestJellyfin={async () => {
            setServiceStatus('Checking Jellyfin')
            setServiceError('')
            try {
              const info = tauri
                ? await import('@tauri-apps/api/core').then(({ invoke }) => invoke<{ name: string; version: string }>('test_jellyfin', { baseUrl: effectiveDownloadConfig.jellyfinUrl, apiKey: effectiveDownloadConfig.jellyfinApiKey }))
                : await postApi<{ name: string; version: string }>('/api/jellyfin/test', { baseUrl: effectiveDownloadConfig.jellyfinUrl, apiKey: effectiveDownloadConfig.jellyfinApiKey })
              setServiceStatus(`${info.name} ${info.version}`)
            } catch (error) {
              setServiceStatus('')
              setServiceError(error instanceof Error ? error.message : 'Could not reach Jellyfin.')
            }
          }}
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
        onClose={() => setJellyfinSignInOpen(false)}
        onSubmit={async (username, password) => {
          setServiceStatus('Signing in to Jellyfin')
          setServiceError('')
          try {
            const token = tauri
              ? await import('@tauri-apps/api/core').then(({ invoke }) => invoke<string>('authenticate_jellyfin', { baseUrl: effectiveDownloadConfig.jellyfinUrl, username, password }))
              : await postApi<{ token: string }>('/api/jellyfin/auth', { baseUrl: effectiveDownloadConfig.jellyfinUrl, username, password }).then((body) => body.token)
            setJellyfinApiKey(token)
            setJellyfinSignInOpen(false)
            setServiceStatus('Jellyfin token saved')
          } catch (error) {
            setServiceStatus('')
            setServiceError(error instanceof Error ? error.message : 'Could not sign in to Jellyfin.')
          }
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
