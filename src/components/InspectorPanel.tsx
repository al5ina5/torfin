import { ExternalLink, Heart, Loader2 } from 'lucide-react'

import { appRouteToUrl, titleRoute } from '../lib/app-routes'
import { youtubeVideoIdFromUrl } from '../lib/cinemeta'
import type { ContentType, JellyfinLibraryMatch, MediaInfo, Movie, ResultProfile, SeriesMetaEpisode, StreamResult } from '../types'
import { AppDrawer } from './AppDrawer'
import { AppLink } from './AppLink'
import { EpisodePicker } from './inspector/EpisodePicker'
import { ExternalLinksGrid } from './inspector/ExternalLinksGrid'
import { GenreChips } from './inspector/GenreChips'
import { InspectorSection } from './inspector/InspectorSection'
import { MetadataFacts } from './inspector/MetadataFacts'
import { PersonCredits } from './inspector/PersonCredits'
import { PopularityStats } from './inspector/PopularityStats'
import { StreamResults } from './StreamResults'
import { PlaybackStatusOverlay } from './PlaybackStatusOverlay'
import { NativePlaybackBanner } from './NativePlaybackBanner'
import { TrailerEmbed } from './TrailerEmbed'
import { VideoPlayer } from './VideoPlayer'

type InspectorPanelProps = {
  contentType: ContentType
  movie: Movie | null
  inWatchlist: boolean
  onToggleWatchlist: () => void
  similarMovies: Movie[]
  onSelectSimilar: (movie: Movie) => void
  onSearchPerson?: (name: string) => void
  onBrowseGenre?: (genre: string) => void
  jellyfinMatch: JellyfinLibraryMatch | null
  jellyfinLoading: boolean
  jellyfinUrl: string
  jellyfinItemUrl?: string
  onOpenInJellyfin?: () => void
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
  showStreamResults?: boolean
  streamEmptyMessage: string
  resultProfile: ResultProfile
  resultsExpanded: boolean
  playbackUrl: string
  playbackTitle: string
  playbackStatus: string
  nativePlayback: { player: string; title: string; mode: 'external' | 'window' } | null
  onPlayEmbedded: () => void
  playbackStartAt: number | null
  playbackDuration: number | null
  playbackMediaOffset: number
  onPlaybackMediaOffsetChange: (offset: number) => void
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
  torboxApiKey: string
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
  contentType,
  movie,
  inWatchlist,
  onToggleWatchlist,
  similarMovies,
  onSelectSimilar,
  onSearchPerson,
  onBrowseGenre,
  jellyfinMatch,
  jellyfinLoading,
  jellyfinUrl: _jellyfinUrl,
  jellyfinItemUrl,
  onOpenInJellyfin,
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
  showStreamResults = true,
  streamEmptyMessage,
  resultProfile,
  resultsExpanded,
  playbackUrl,
  playbackTitle,
  playbackStatus,
  nativePlayback,
  onPlayEmbedded,
  playbackStartAt,
  playbackDuration,
  playbackMediaOffset,
  onPlaybackMediaOffsetChange,
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
  torboxApiKey,
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
  const upgradeWarning = jellyfinMatch && topStreamQuality && jellyfinMatch.height
    ? topStreamQuality > jellyfinMatch.height
    : false
  const trailerVideoId = movie.trailer ? youtubeVideoIdFromUrl(movie.trailer) : undefined

  return (
    <section>
      <div className="relative overflow-hidden border-b border-[var(--mac-divider,var(--mac-border))] bg-[var(--mac-control)]">
        {movie.background || movie.poster ? (
          <img
            src={movie.background || movie.poster}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-50 blur-sm"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--mac-sidebar)] via-[var(--mac-sidebar)]/80 to-[var(--mac-sidebar)]/20" />
        <div className="relative app-screen-body py-4">
          <div className="flex gap-3">
            {movie.poster ? (
              <img
                src={movie.poster}
                alt=""
                className="h-32 w-[88px] shrink-0 rounded-xl border border-[var(--mac-border)] object-cover shadow-xl sm:h-36 sm:w-[98px]"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {movie.logo ? (
                    <img
                      src={movie.logo}
                      alt={movie.name}
                      className="mb-1 max-h-11 max-w-[min(100%,240px)] object-contain object-left sm:max-h-12"
                    />
                  ) : (
                    <h2 className="line-clamp-2 text-[18px] font-semibold leading-6 tracking-normal sm:text-[20px]">{movie.name}</h2>
                  )}
                  {movie.logo ? (
                    <p className="line-clamp-1 text-[12px] text-[var(--mac-tertiary)]">{movie.name}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onToggleWatchlist}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--mac-border)] bg-[var(--mac-control)]/90 backdrop-blur sm:size-8"
                  aria-label={inWatchlist ? `Remove ${movie.name} from watchlist` : `Add ${movie.name} to watchlist`}
                >
                  <Heart size={15} fill={inWatchlist ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--mac-secondary)]">
                {movie.imdbRating ? (
                  movie.imdbUrl ? (
                    <a
                      href={movie.imdbUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-yellow-500/35 bg-yellow-500/10 px-2 py-0.5 font-semibold text-yellow-900 hover:bg-yellow-500/15 dark:text-yellow-100"
                    >
                      ★ {movie.imdbRating}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="rounded-full border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2 py-0.5 font-semibold">
                      ★ {movie.imdbRating}
                    </span>
                  )
                ) : null}
                {movie.genres?.length ? <GenreChips genres={movie.genres.slice(0, 4)} onBrowseGenre={onBrowseGenre} /> : null}
              </div>

              {jellyfinLoading ? (
                <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2.5 py-1 text-[10px] text-[var(--mac-secondary)]">
                  <Loader2 className="animate-spin" size={11} />
                  Checking Jellyfin
                </div>
              ) : jellyfinMatch ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {jellyfinItemUrl && onOpenInJellyfin ? (
                    <button
                      type="button"
                      onClick={onOpenInJellyfin}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Play in Jellyfin
                      <ExternalLink size={11} />
                    </button>
                  ) : null}
                  <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
                    In Jellyfin · {jellyfinMatch.qualityLabel || 'Available'}
                  </span>
                  {upgradeWarning ? (
                    <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-200">
                      Higher quality available
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="app-screen-body space-y-5 py-4">
        {trailerVideoId ? (
          <InspectorSection title="Trailer">
            <TrailerEmbed trailerUrl={movie.trailer!} title={movie.name} />
          </InspectorSection>
        ) : movie.trailer ? (
          <a
            href={movie.trailer}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)] sm:h-8"
          >
            Find trailer on YouTube
            <ExternalLink size={13} />
          </a>
        ) : null}

        {movie.popularities ? (
          <InspectorSection title="Popularity">
            <PopularityStats popularities={movie.popularities} />
          </InspectorSection>
        ) : null}

        <InspectorSection title="Details">
          <div className="space-y-3">
            <MetadataFacts movie={movie} />
            {movie.description ? (
              <p className="text-[13px] leading-6 text-[var(--mac-secondary)]">{movie.description}</p>
            ) : null}
            {movie.awards ? (
              <p className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2.5 text-[12px] leading-5 text-[var(--mac-secondary)]">
                <span className="font-semibold text-[var(--mac-text)]">Awards · </span>
                {movie.awards}
              </p>
            ) : null}
          </div>
        </InspectorSection>

        {movie.externalLinks?.length ? (
          <InspectorSection title="Find on">
            <ExternalLinksGrid links={movie.externalLinks} />
          </InspectorSection>
        ) : null}

        {movie.director?.length || movie.writer?.length || movie.cast?.length ? (
          <InspectorSection title="Credits">
            <div className="space-y-4">
              <PersonCredits label="Director" names={movie.director ?? []} contentType={contentType} onSearchPerson={onSearchPerson} />
              <PersonCredits label="Writer" names={movie.writer ?? []} contentType={contentType} onSearchPerson={onSearchPerson} />
              <PersonCredits label="Cast" names={movie.cast ?? []} contentType={contentType} onSearchPerson={onSearchPerson} />
            </div>
          </InspectorSection>
        ) : null}

        {similarMovies.length ? (
          <InspectorSection title="Similar">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {similarMovies.map((entry) => (
                <AppLink
                  key={entry.id}
                  href={appRouteToUrl(titleRoute(entry))}
                  onNavigate={() => onSelectSimilar(entry)}
                  className="w-20 shrink-0 text-left"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] shadow-sm">
                    {entry.poster ? <img src={entry.poster} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-[10px] leading-3 text-[var(--mac-secondary)]">{entry.name}</div>
                </AppLink>
              ))}
            </div>
          </InspectorSection>
        ) : null}

        {isSeries ? (
          <EpisodePicker
            episodeOptions={episodeOptions}
            loadingEpisodes={loadingEpisodes}
            episodeLoadError={episodeLoadError}
            selectedSeason={selectedSeason}
            selectedEpisode={selectedEpisode}
            onSeasonChange={onSeasonChange}
            onEpisodeChange={onEpisodeChange}
            onDownloadSeason={onDownloadSeason}
            batchDownloading={batchDownloading}
          />
        ) : null}

        {playbackUrl || playbackStatus || nativePlayback || nextEpisodePrompt ? (
          <section className="overflow-hidden rounded-xl border border-black/20 bg-black shadow-lg">
            {nativePlayback ? (
              <NativePlaybackBanner
                player={nativePlayback.player}
                title={nativePlayback.title}
                mode={nativePlayback.mode}
                onPlayEmbedded={onPlayEmbedded}
              />
            ) : null}
            {!nativePlayback && playbackUrl ? (
              <VideoPlayer
                key={playbackUrl}
                url={playbackUrl}
                title={playbackTitle}
                autoPlay
                startAt={playbackStartAt}
                knownDuration={playbackDuration ?? mediaInfo?.duration ?? null}
                mediaOffset={playbackMediaOffset}
                onMediaOffsetChange={onPlaybackMediaOffsetChange}
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
            {!nativePlayback && playbackStatus ? (
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

        {showStreamResults ? (
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
          torboxApiKey={torboxApiKey}
          onPlay={onPlay}
            onDownload={onDownload}
          />
        ) : null}
      </div>
    </section>
  )
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { movie, mobileOpen = false, onMobileClose, ...contentProps } = props

  return (
    <>
      <aside className="app-sidebar-desktop mac-sidebar hidden min-h-0 flex-col lg:flex" data-focus-zone="inspector">
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

      {movie ? (
        <AppDrawer
          open={mobileOpen}
          title={movie.name}
          subtitle={movie.releaseInfo}
          onClose={() => onMobileClose?.()}
          zClassName="z-[45]"
          bodyClassName="p-0"
          ariaLabel={movie.name}
          titleId="app-inspector-title"
          focusZone="inspector"
        >
          <InspectorContent movie={movie} {...contentProps} />
        </AppDrawer>
      ) : null}
    </>
  )
}
