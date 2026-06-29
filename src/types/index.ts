export type ContentType = 'movie' | 'series'

export type CinemetaCatalogId = '' | 'top' | 'imdbRating' | 'year'
export type MovieSort = 'catalog' | 'ratingDesc' | 'yearDesc' | 'yearAsc' | 'titleAsc'
export type BuiltinResultProfile = 'netflix' | 'dataSaver' | 'cinephile'
export type ResultProfile = BuiltinResultProfile | (string & {})
export type DownloadSort = 'newest' | 'oldest' | 'active' | 'finishedLast'
export type PreferencesTab = 'general' | 'playback' | 'downloads' | 'plugins' | 'advanced'

export type LibraryCatalogId = 'watchlist' | 'continue' | 'recent'

export type StartupCatalogId =
  | 'lastUsed'
  | LibraryCatalogId
  | 'trending'
  | 'topRated'
  | 'featured'
  | 'newReleases'

export type JellyfinDuplicateAction = 'ask' | 'allow' | 'block'

export type NextEpisodeCountdownSeconds = 0 | 5 | 10 | 15

export type ApiRequestTimeoutSeconds = 10 | 15 | 30

export type CustomStreamProfile = {
  id: string
  label: string
  maxResolution: 0 | 480 | 720 | 1080 | 2160
  minResolution: 0 | 720 | 1080
  maxFileSizeGb: number
  hideCam: boolean
  hide3d: boolean
  preferCached: boolean
  maxResults: number
  onePerResolution: boolean
}

export type Movie = {
  id: string
  type: ContentType
  name: string
  poster?: string
  background?: string
  releaseInfo?: string
  description?: string
  genres?: string[]
  imdbRating?: string
  cast?: string[]
  director?: string[]
  runtime?: string
  trailer?: string
}

export type CinemetaMovie = {
  id?: string
  imdb_id?: string
  name?: string
  title?: string
  genres?: string[]
  genre?: string[]
  imdbRating?: number | string
  releaseInfo?: string
  [key: string]: unknown
}

export type PluginConfig = {
  id: string
  name: string
  enabled: boolean
  streamUrlTemplate: string
}

export type StreamResult = {
  pluginName: string
  title: string
  description?: string
  url?: string
  externalUrl?: string
  infoHash?: string
  fileIdx?: number
  rank: number
  tags: string[]
}

export type MovieFilters = {
  apiCatalog: CinemetaCatalogId
  genre: string
  releaseYear: string
  yearFrom: string
  yearTo: string
  minRating: string
  sortBy: MovieSort
}

export type AppPreferences = {
  posterSize: number
  showRatings: boolean
  showYears: boolean
  defaultProfile: ResultProfile
  autoPlayResolvedStreams: boolean
  preferCachedResults: boolean
  customProfiles: CustomStreamProfile[]
  autoPlayNextEpisode: boolean
  downloadNotifications: boolean
  theme: ThemeMode
  libraryViewMode: LibraryViewMode
  defaultContentType: ContentType
  defaultStartupCatalog: StartupCatalogId
  compactResultsLimit: number
  continueWatchingLimit: number
  recentViewsLimit: number
  searchHistoryEnabled: boolean
  nextEpisodeCountdown: NextEpisodeCountdownSeconds
  expandStreamResultsByDefault: boolean
  resumeMinSeconds: number
  completeRatioPercent: number
  alwaysConfirmDownloadDestination: boolean
  jellyfinDuplicateAction: JellyfinDuplicateAction
  apiRequestTimeoutSeconds: ApiRequestTimeoutSeconds
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type LibraryViewMode = 'grid' | 'list'

export type FilterPreset = {
  id: string
  name: string
  builtIn?: boolean
  filters: MovieFilters
}

export type TorboxAccountSummary = {
  email?: string
  plan?: string
  planId?: number
  premium?: boolean
  expiresAt?: string
  totalTorrents?: number
  activeTorrents?: number
  cachedTorrents?: number
}

export type DownloadDestinationKind = 'local' | 'remote'

export type DownloadDestination = {
  id: string
  name: string
  kind: DownloadDestinationKind
  isDefault: boolean
  moviesPath: string
  tvPath: string
  sshHost: string
  sshPort: number
  sshUsername: string
  lastTestedAt?: string
  lastTestOk?: boolean
  lastTestMessage?: string
}

export type DownloadConfig = {
  jellyfinUrl: string
  jellyfinApiKey: string
  downloader: 'local' | 'ssh' | 'qbittorrent'
  localSavePath: string
  tvSavePath: string
  sshHost: string
  sshUsername: string
  sshPassword: string
  sshSavePath: string
  qbittorrentUrl: string
  qbittorrentUsername: string
  qbittorrentPassword: string
  savePath: string
  category: string
  refreshJellyfinOnComplete: boolean
  activeDestinationId: string
  destinations: DownloadDestination[]
}

export type DownloadStatus = {
  id: string
  hash?: string
  name: string
  progress: number
  state: string
  speed: number
  eta: number
  size: number
  downloaded: number
  savePath?: string
  targetPath?: string
  partialPath?: string
  statusPath?: string
  complete: boolean
  createdAt?: string
  engine?: string
  logPath?: string
  connections?: number
  gid?: string
  jellyfinRefreshRequested?: string
  jellyfinRefreshOk?: string
  jellyfinRefreshError?: string
  jellyfinImportedAt?: string
  jellyfinItemId?: string
  jellyfinItemPath?: string
  jellyfinImportError?: string
  statusMessage?: string
  statusAction?: string
  stalledSince?: string
}

export type DownloadJob = {
  pendingId?: string
  createdAt?: string
  movie: Movie
  stream: StreamResult
  sourceUrl?: string
  status?: DownloadStatus
  error?: string
  jellyfinRefreshed?: boolean
  paused?: boolean
  destinationId?: string
  destinationName?: string
  pollConfig?: DownloadPollConfig
}

export type DownloadPollConfig = {
  mode: 'local' | 'ssh' | 'qbittorrent'
  ssh?: {
    host: string
    username: string
    password: string | null
    savePath: string
  }
  local?: {
    savePath: string
  }
  qbittorrent?: {
    baseUrl: string
    username: string
    password: string
    savePath: string | null
    category: string | null
  }
  jellyfin?: {
    baseUrl: string
    apiKey: string
    refreshOnComplete: boolean
  }
}

export type PlaybackProgress = {
  movieId: string
  type: ContentType
  season?: number
  episode?: number
  position: number
  duration: number
  updatedAt: string
  movie: Movie
}

export type JellyfinLibraryMatch = {
  itemId: string
  name: string
  path?: string
  qualityLabel?: string
  playUrl?: string
  width?: number
  height?: number
  isUpgrade?: boolean
}

export type MediaTrack = {
  index: number
  kind: 'audio' | 'subtitle'
  label: string
  language?: string
  codec?: string
}

export type MediaInfo = {
  duration?: number
  formatName?: string
  videoCodec?: string
  audioCodecs: string[]
  audioTracks: MediaTrack[]
  subtitleTracks: MediaTrack[]
}

export type SeriesMetaEpisode = {
  id: string
  title?: string
  overview?: string
  released?: string
  thumbnail?: string
  episode: number
  season: number
}

export type SeriesMeta = {
  id: string
  name: string
  videos?: SeriesMetaEpisode[]
}
