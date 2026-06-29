import { Heart, Loader2 } from 'lucide-react'

import { formatProgressLabel, loadPlaybackProgress, progressPercent } from '../lib/playback-progress'
import type { Movie } from '../types'
import { MovieEmptyState } from './MovieEmptyState'
import { MovieGridSkeleton } from './MovieGridSkeleton'
import { MoviePoster } from './MoviePoster'

type MovieGridProps = {
  movies: Movie[]
  selectedMovieId?: string
  focusedMovieIndex?: number
  catalogId?: string
  contentKey?: string
  watchlistIds?: Set<string>
  posterSize: number
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

export function MovieGrid({
  movies,
  selectedMovieId,
  focusedMovieIndex = -1,
  catalogId,
  contentKey = '',
  watchlistIds,
  posterSize,
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
}: MovieGridProps) {
  const progressById = new Map(
    loadPlaybackProgress().map((entry) => [`${entry.type}:${entry.movieId}`, entry]),
  )
  const showLoadMore = !shouldRemoteSearch && hasMoreMovies && !loading
  const showEmpty = !loading && !loadingMore && movies.length === 0

  return (
    <div
      ref={scrollRef}
      className={`min-h-0 flex-1 overflow-y-auto px-5 py-5${showEmpty ? ' flex flex-col' : ''}`}
    >
      {loading ? (
        <MovieGridSkeleton posterSize={posterSize} />
      ) : movies.length ? (
        <div
          key={contentKey}
          className="grid gap-x-4 gap-y-5"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${posterSize}px, 1fr))` }}
        >
          {movies.map((movie, index) => {
            const progress = progressById.get(`${movie.type}:${movie.id}`)
            const inWatchlist = watchlistIds?.has(`${movie.type}:${movie.id}`)
            const isFocused = focusedMovieIndex === index
            return (
              <div
                key={`${movie.type}:${movie.id}`}
                className="movie-item-enter group relative min-w-0"
                style={{ animationDelay: `${Math.min(index, 28) * 16}ms` }}
              >
                <button
                  type="button"
                  onClick={() => onSelectMovie(movie)}
                  className="w-full rounded-lg text-left outline-none active:scale-[0.98] transition-transform duration-100"
                >
                  <div
                    className={`relative aspect-[2/3] overflow-hidden rounded-lg border bg-[var(--mac-control)] shadow-sm transition-[border-color,box-shadow] duration-150 ${
                      selectedMovieId === movie.id || isFocused
                        ? 'border-[var(--mac-accent)] ring-2 ring-[var(--mac-accent)]/30'
                        : 'border-[var(--mac-border)] group-hover:border-[var(--mac-border-strong)]'
                    }`}
                  >
                    <MoviePoster src={movie.poster} priority={index < 24} />
                    {progress && catalogId === 'continue' ? (
                      <div className="absolute inset-x-2 bottom-10 h-1 overflow-hidden rounded-full bg-black/40">
                        <div
                          className="h-full rounded-full bg-[var(--mac-accent)] transition-[width] duration-200"
                          style={{ width: `${progressPercent(progress)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 min-h-12 px-1">
                    <div className="line-clamp-2 text-[13px] font-medium leading-[17px]">{movie.name}</div>
                    <div className="mt-1 flex min-h-[15px] items-center justify-between gap-2 text-[11px] text-[var(--mac-secondary)]">
                      <span>
                        {catalogId === 'continue' && progress
                          ? `${formatProgressLabel(progress) || movie.releaseInfo || 'Resume'}`
                          : showYears
                            ? movie.releaseInfo ?? 'Movie'
                            : ''}
                      </span>
                      {showRatings && movie.imdbRating ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[10px]">★</span>
                          {movie.imdbRating}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
                {onToggleWatchlist ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleWatchlist(movie)
                    }}
                    className={`absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-black/20 bg-black/55 text-white transition-[opacity,transform,background] duration-150 hover:scale-105 hover:bg-black/75 active:scale-95 ${
                      inWatchlist ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    <Heart size={13} fill={inWatchlist ? 'currentColor' : 'none'} />
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
