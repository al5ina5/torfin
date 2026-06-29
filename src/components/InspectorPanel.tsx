import { ChevronLeft, Download, ExternalLink, Heart, Loader2 } from 'lucide-react'

import { useSwipeDismiss } from '../hooks/useSwipeDismiss'
import type { JellyfinLibraryMatch, MediaInfo, Movie, ResultProfile, SeriesMetaEpisode, StreamResult } from '../types'
import { StreamResults } from './StreamResults'
import { PlaybackStatusOverlay } from './PlaybackStatusOverlay'
import { VideoPlayer } from './VideoPlayer'

type InspectorPanelProps = {
  movie: Movie | null
  inWatchlist: boolean
  onToggleWatchlist: () => void
  similarMovies: Movie[]
  onSelectSimilar: (movie: Movie) => void
  onSearchPerson?: (name: string) => void
  jellyfinMatch: JellyfinLibraryMatch | null
  jellyfinLoading: boolean
  jellyfinUrl: string
  topStreamQuality?: number
  episodeOptions: SeriesMetaEpisode[]
  loadingEpisodes: boolean
  episodeLoadError: string
  selectedSeason: number | null
  selectedEpisode: number | null
  onSeasonChange: (season: number) => void
  onEpisodeChange: (episode: number) => void
  onDownloadSeason?: () => void
  batchDownloading?: boolean
  streams: StreamResult[]
  compactStreams: StreamResult[]
  profileOptions: Array<{ id: ResultProfile; label: string; description?: string }>
  loadingStreams: boolean
  streamEmptyMessage: string
  resultProfile: ResultProfile
  resultsExpanded: boolean
  playbackUrl: string
  playbackTitle: string
  playbackStatus: string
  playbackStartAt: number | null
  mediaInfo: MediaInfo | null
  selectedAudioIndex: number | null
  selectedSubtitleIndex: number | null
  onPlaybackError?: () => void
  onPlaybackTimeUpdate?: (currentTime: number, duration: number) => void
  onPlaybackEnded?: () => void
  nextEpisodePrompt?: { remaining: number; next: { season: number; episode: number } } | null
  onCancelNextEpisode?: () => void
  resolvingKey: string
  downloadingKey: string
  onChooseAudio: (value: string) => void
  onChooseSubtitle: (value: string) => void
  onRefreshStreams: () => void
  onResultProfileChange: (profile: ResultProfile) => void
  onToggleResultsExpanded: () => void
  onPlay: (stream: StreamResult, index: number) => void
  onDownload: (stream: StreamResult, index: number) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

type InspectorContentProps = Omit<InspectorPanelProps, 'mobileOpen' | 'onMobileClose'>

function InspectorContent({
  movie,
  inWatchlist,
  onToggleWatchlist,
  similarMovies,
  onSelectSimilar,
  onSearchPerson,
  jellyfinMatch,
  jellyfinLoading,
  jellyfinUrl,
  topStreamQuality,
  episodeOptions,
  loadingEpisodes,
  episodeLoadError,
  selectedSeason,
  selectedEpisode,
  onSeasonChange,
  onEpisodeChange,
  onDownloadSeason,
  batchDownloading,
  streams,
  compactStreams,
  profileOptions,
  loadingStreams,
  streamEmptyMessage,
  resultProfile,
  resultsExpanded,
  playbackUrl,
  playbackTitle,
  playbackStatus,
  playbackStartAt,
  mediaInfo,
  selectedAudioIndex,
  selectedSubtitleIndex,
  onPlaybackError,
  onPlaybackTimeUpdate,
  onPlaybackEnded,
  nextEpisodePrompt,
  onCancelNextEpisode,
  resolvingKey,
  downloadingKey,
  onChooseAudio,
  onChooseSubtitle,
  onRefreshStreams,
  onResultProfileChange,
  onToggleResultsExpanded,
  onPlay,
  onDownload,
}: InspectorContentProps) {
  if (!movie) return null

  const isSeries = movie.type === 'series'
  const seasonOptions = [...new Set(episodeOptions.map((entry) => entry.season))].sort((a, b) => a - b)
  const episodesForSeason = episodeOptions.filter((entry) => entry.season === selectedSeason)
  const upgradeWarning = jellyfinMatch && topStreamQuality && jellyfinMatch.height
    ? topStreamQuality > jellyfinMatch.height
    : false

  return (
    <section>
      <div className="relative h-44 overflow-hidden border-b border-[var(--mac-divider,var(--mac-border))] bg-[var(--mac-control)] sm:h-52">
        {movie.background || movie.poster ? (
          <img
            src={movie.background || movie.poster}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-55 blur-sm"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--mac-sidebar)] via-[var(--mac-sidebar)]/75 to-transparent" />
        <div className="relative flex h-full items-end gap-3 p-4">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt=""
              className="h-28 w-[76px] rounded-lg border border-[var(--mac-border)] object-cover shadow-lg sm:h-32 sm:w-[86px]"
            />
          ) : null}
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-start gap-2">
              <h2 className="line-clamp-2 flex-1 text-[18px] font-semibold leading-6 tracking-normal sm:text-[20px]">{movie.name}</h2>
              <button
                type="button"
                onClick={onToggleWatchlist}
                className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] sm:size-8"
                title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Heart size={15} fill={inWatchlist ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[var(--mac-secondary)]">
              <span>{movie.releaseInfo}</span>
              {movie.runtime ? <span>{movie.runtime}</span> : null}
              {movie.imdbRating ? <span>{movie.imdbRating} IMDb</span> : null}
            </div>
            {jellyfinLoading ? (
              <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2 py-1 text-[10px] text-[var(--mac-secondary)]">
                <Loader2 className="animate-spin" size={11} />
                Checking Jellyfin
              </div>
            ) : jellyfinMatch ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
                  In Jellyfin · {jellyfinMatch.qualityLabel || 'Available'}
                </span>
                {upgradeWarning ? (
                  <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-200">
                    Higher quality available
                  </span>
                ) : null}
                {jellyfinUrl ? (
                  <a
                    href={jellyfinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--mac-accent)]"
                  >
                    Open in Jellyfin
                    <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {movie.description ? (
          <p className="line-clamp-6 text-[13px] leading-5 text-[var(--mac-secondary)] sm:line-clamp-4">{movie.description}</p>
        ) : null}

        {movie.director?.length ? (
          <div className="text-[12px] leading-5 text-[var(--mac-secondary)]">
            <span className="font-semibold text-[var(--mac-text)]">Director: </span>
            {movie.director.map((name, index) => (
              <span key={name}>
                {index > 0 ? ', ' : ''}
                {onSearchPerson ? (
                  <button type="button" onClick={() => onSearchPerson(name)} className="font-medium text-[var(--mac-accent)] hover:underline">
                    {name}
                  </button>
                ) : (
                  name
                )}
              </span>
            ))}
          </div>
        ) : null}

        {movie.cast?.length ? (
          <div className="text-[12px] leading-5 text-[var(--mac-secondary)]">
            <span className="font-semibold text-[var(--mac-text)]">Cast: </span>
            {movie.cast.slice(0, 6).map((name, index) => (
              <span key={name}>
                {index > 0 ? ', ' : ''}
                {onSearchPerson ? (
                  <button type="button" onClick={() => onSearchPerson(name)} className="font-medium text-[var(--mac-accent)] hover:underline">
                    {name}
                  </button>
                ) : (
                  name
                )}
              </span>
            ))}
          </div>
        ) : null}

        {movie.trailer ? (
          <a
            href={movie.trailer}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)] sm:h-8"
          >
            Watch Trailer
            <ExternalLink size={13} />
          </a>
        ) : null}

        {similarMovies.length ? (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">Similar</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {similarMovies.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectSimilar(entry)}
                  className="w-16 shrink-0 text-left"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)]">
                    {entry.poster ? <img src={entry.poster} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[10px] leading-3">{entry.name}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isSeries ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">Season</span>
                <select
                  value={selectedSeason ?? ''}
                  onChange={(event) => onSeasonChange(Number(event.target.value))}
                  disabled={loadingEpisodes || !seasonOptions.length}
                  className="h-9 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[13px] outline-none focus:border-[var(--mac-accent)] disabled:opacity-50 sm:h-8"
                >
                  {loadingEpisodes ? <option value="">Loading…</option> : null}
                  {!loadingEpisodes && !seasonOptions.length ? (
                    <option value="">{episodeLoadError || 'No seasons found'}</option>
                  ) : null}
                  {seasonOptions.map((season) => (
                    <option key={season} value={season}>
                      Season {season}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">Episode</span>
                <select
                  value={selectedEpisode ?? ''}
                  onChange={(event) => onEpisodeChange(Number(event.target.value))}
                  disabled={loadingEpisodes || !episodesForSeason.length}
                  className="h-9 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[13px] outline-none focus:border-[var(--mac-accent)] disabled:opacity-50 sm:h-8"
                >
                  {loadingEpisodes ? <option value="">Loading…</option> : null}
                  {!loadingEpisodes && !episodesForSeason.length ? <option value="">—</option> : null}
                  {episodesForSeason.map((entry) => (
                    <option key={`${entry.season}-${entry.episode}`} value={entry.episode}>
                      {entry.episode}. {entry.title || `Episode ${entry.episode}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {onDownloadSeason ? (
              <button
                type="button"
                disabled={batchDownloading || !episodesForSeason.length}
                onClick={onDownloadSeason}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)] disabled:opacity-50 sm:h-8"
              >
                {batchDownloading ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
                Download Season {selectedSeason}
              </button>
            ) : null}
          </div>
        ) : null}

        {playbackUrl || playbackStatus || nextEpisodePrompt ? (
          <section className="overflow-hidden rounded-lg border border-black/20 bg-black shadow-lg">
            {playbackUrl ? (
              <VideoPlayer
                key={playbackUrl}
                url={playbackUrl}
                title={playbackTitle}
                autoPlay
                startAt={playbackStartAt}
                mediaInfo={mediaInfo}
                selectedAudioIndex={selectedAudioIndex}
                selectedSubtitleIndex={selectedSubtitleIndex}
                onSelectAudio={onChooseAudio}
                onSelectSubtitle={onChooseSubtitle}
                onError={onPlaybackError}
                onTimeUpdate={onPlaybackTimeUpdate}
                onEnded={onPlaybackEnded}
              />
            ) : null}
            {playbackStatus ? (
              <PlaybackStatusOverlay status={playbackStatus} mediaInfo={mediaInfo} />
            ) : null}
            {nextEpisodePrompt ? (
              <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/90 px-3 py-2.5">
                <p className="text-[12px] text-white/90">
                  Next episode S{String(nextEpisodePrompt.next.season).padStart(2, '0')}E
                  {String(nextEpisodePrompt.next.episode).padStart(2, '0')} in {nextEpisodePrompt.remaining}s
                </p>
                <button
                  type="button"
                  onClick={onCancelNextEpisode}
                  className="h-7 shrink-0 rounded-md border border-white/20 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <StreamResults
          streams={streams}
          compactStreams={compactStreams}
          profileOptions={profileOptions}
          loading={loadingStreams}
          profile={resultProfile}
          onProfileChange={onResultProfileChange}
          resultsExpanded={resultsExpanded}
          onToggleExpanded={onToggleResultsExpanded}
          emptyMessage={streamEmptyMessage}
          onRefresh={onRefreshStreams}
          resolvingKey={resolvingKey}
          downloadingKey={downloadingKey}
          onPlay={onPlay}
          onDownload={onDownload}
        />
      </div>
    </section>
  )
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { movie, mobileOpen = false, onMobileClose, ...contentProps } = props
  const swipeDismiss = useSwipeDismiss(() => onMobileClose?.(), 'right')

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="app-sidebar-desktop mac-sidebar hidden min-h-0 flex-col lg:flex">
        {!movie ? (
          <div className="grid h-full min-h-96 place-items-center p-6 text-center text-[13px] text-[var(--mac-secondary)]">
            Pick a title to inspect streams.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <InspectorContent movie={movie} {...contentProps} />
          </div>
        )}
      </aside>

      {/* Mobile full-screen sheet */}
      {movie ? (
        <>
          <div
            className={`app-inspector-backdrop lg:hidden ${mobileOpen ? 'is-open' : ''}`}
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div
            className={`app-inspector-sheet mac-sidebar lg:hidden ${mobileOpen ? 'is-open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={movie.name}
            {...swipeDismiss}
          >
            <header className="app-inspector-sheet-header">
              <button
                type="button"
                onClick={onMobileClose}
                className="app-mobile-menu-btn"
                aria-label="Back to browse"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{movie.name}</div>
                <div className="truncate text-[11px] text-[var(--mac-secondary)]">{movie.releaseInfo}</div>
              </div>
            </header>
            <div className="modal-scroll min-h-0 flex-1">
              <InspectorContent movie={movie} {...contentProps} />
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
