import { Heart, Loader2 } from 'lucide-react'

import { formatProgressLabel, loadPlaybackProgress, progressPercent } from '../lib/playback-progress'
import type { Movie, PlaybackProgress } from '../types'
import { MovieEmptyState } from './MovieEmptyState'
import { MoviePoster } from './MoviePoster'

type MovieListProps = {
  movies: Movie[]
  selectedMovieId?: string
  focusedMovieIndex?: number
  catalogId?: string
  contentKey?: string
  watchlistIds?: Set<string>
  showYears: boolean
  showRatings: boolean
  loading: boolean
  loadingMore: boolean
  hasMoreMovies: boolean
  shouldRemoteSearch: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  loadMoreRef: React.RefObject<HTMLDivElement | null>
  onSelectMovie: (movie: Movie) => void
  onToggleWatchlist?: (movie: Movie) => void
  onClearFilters?: () => void
}

function movieMetaLine(
  movie: Movie,
  {
    catalogId,
    progress,
    showYears,
    showRatings,
  }: {
    catalogId?: string
    progress?: PlaybackProgress
    showYears: boolean
    showRatings: boolean
  },
) {
  const parts: string[] = []
  if (catalogId === 'continue' && progress) parts.push(formatProgressLabel(progress))
  if (showYears && movie.releaseInfo) parts.push(movie.releaseInfo)
  if (movie.genres?.length) parts.push(...movie.genres.slice(0, 2))
  if (showRatings && movie.imdbRating) parts.push(`★ ${movie.imdbRating}`)
  return parts.join(' · ')
}

function ListSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-1.5 @min-[380px]:grid-cols-2 @min-[580px]:grid-cols-3 @min-[780px]:grid-cols-4"
      aria-busy
      aria-label="Loading titles"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          className="movie-skeleton-enter flex min-w-0 items-center gap-2 rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] p-1.5"
          style={{ animationDelay: `${index * 18}ms` }}
        >
          <div className="movie-poster-skeleton h-10 w-7 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="movie-poster-skeleton h-3 w-[85%] rounded" />
            <div className="movie-poster-skeleton h-2.5 w-[55%] rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MovieList({
  movies,
  selectedMovieId,
  focusedMovieIndex = -1,
  catalogId,
  contentKey = '',
  watchlistIds,
  showYears,
  showRatings,
  loading,
  loadingMore,
  hasMoreMovies,
  shouldRemoteSearch,
  scrollRef,
  loadMoreRef,
  onSelectMovie,
  onToggleWatchlist,
  onClearFilters,
}: MovieListProps) {
  const progressById = new Map(
    loadPlaybackProgress().map((entry) => [`${entry.type}:${entry.movieId}`, entry]),
  )
  const showEmpty = !loading && !loadingMore && movies.length === 0
  const showLoadMore = !shouldRemoteSearch && hasMoreMovies && !loading

  return (
    <div
      ref={scrollRef}
      className={`app-movie-scroll @container min-h-0 flex-1 overflow-y-auto app-touch-bottom-scroll-padded-sm${showEmpty ? ' flex flex-col' : ''}`}
    >
      {loading ? (
        <ListSkeleton />
      ) : movies.length ? (
        <div
          key={contentKey}
          className="grid grid-cols-1 gap-1.5 @min-[380px]:grid-cols-2 @min-[580px]:grid-cols-3 @min-[780px]:grid-cols-4"
        >
          {movies.map((movie, index) => {
            const progress = progressById.get(`${movie.type}:${movie.id}`)
            const inWatchlist = watchlistIds?.has(`${movie.type}:${movie.id}`)
            const isFocused = focusedMovieIndex === index
            const metaLine = movieMetaLine(movie, { catalogId, progress, showYears, showRatings })
            return (
              <div
                key={`${movie.type}:${movie.id}`}
                className={`movie-item-enter group flex min-w-0 items-center gap-1.5 rounded-md border bg-[var(--mac-surface)] p-1.5 transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.995] ${
                  selectedMovieId === movie.id || isFocused
                    ? 'border-[var(--mac-accent)] ring-2 ring-[var(--mac-accent)]/20'
                    : 'border-[var(--mac-border)] hover:border-[var(--mac-border-strong)]'
                }`}
                style={{ animationDelay: `${Math.min(index, 20) * 10}ms` }}
              >
                <button
                  type="button"
                  onClick={() => onSelectMovie(movie)}
                  className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
                >
                  <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded border border-[var(--mac-border)] bg-[var(--mac-control)]">
                    <MoviePoster src={movie.poster} iconSize={12} priority={index < 20} />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="truncate text-[12px] font-medium leading-snug">{movie.name}</div>
                    {metaLine ? (
                      <div className="mt-0.5 truncate text-[10px] leading-snug text-[var(--mac-secondary)]">{metaLine}</div>
                    ) : null}
                    {progress && catalogId === 'continue' ? (
                      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-[var(--mac-control)]">
                        <div
                          className="h-full rounded-full bg-[var(--mac-accent)] transition-[width] duration-200"
                          style={{ width: `${progressPercent(progress)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </button>
                {onToggleWatchlist ? (
                  <button
                    type="button"
                    onClick={() => onToggleWatchlist(movie)}
                    className="grid size-6 shrink-0 place-items-center rounded border border-[var(--mac-border)] bg-[var(--mac-control)] transition-[transform,background] duration-150 hover:bg-[var(--mac-control-hover)] active:scale-95"
                    aria-label={inWatchlist ? `Remove ${movie.name} from watchlist` : `Add ${movie.name} to watchlist`}
                  >
                    <Heart size={11} fill={inWatchlist ? 'currentColor' : 'none'} />
                  </button>
                ) : null}
              </div>
            )
          })}

          {showLoadMore ? (
            <div
              ref={loadMoreRef}
              className="col-span-full grid h-10 place-items-center"
              aria-hidden={!loadingMore}
            >
              {loadingMore ? (
                <Loader2 className="animate-spin text-[var(--mac-accent)]" size={18} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : showEmpty ? (
        <MovieEmptyState catalogId={catalogId} onClearFilters={onClearFilters} />
      ) : null}
    </div>
  )
}
