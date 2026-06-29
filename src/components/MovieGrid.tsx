import { Heart, Loader2, Star } from 'lucide-react'

import { formatProgressLabel, loadPlaybackProgress, progressPercent } from '../lib/playback-progress'
import type { Movie } from '../types'

type MovieGridProps = {
  movies: Movie[]
  selectedMovieId?: string
  focusedMovieIndex?: number
  catalogId?: string
  watchlistIds?: Set<string>
  posterSize: number
  showYears: boolean
  showRatings: boolean
  loading: boolean
  loadingMore: boolean
  movieErrorMessage?: string
  searchErrorMessage?: string
  hasMoreMovies: boolean
  shouldRemoteSearch: boolean
  loadMoreRef: React.RefObject<HTMLDivElement | null>
  onSelectMovie: (movie: Movie) => void
  onToggleWatchlist?: (movie: Movie) => void
}

export function MovieGrid({
  movies,
  selectedMovieId,
  focusedMovieIndex = -1,
  catalogId,
  watchlistIds,
  posterSize,
  showYears,
  showRatings,
  loading,
  loadingMore,
  movieErrorMessage = '',
  searchErrorMessage = '',
  hasMoreMovies,
  shouldRemoteSearch,
  loadMoreRef,
  onSelectMovie,
  onToggleWatchlist,
}: MovieGridProps) {
  const progressById = new Map(
    loadPlaybackProgress().map((entry) => [`${entry.type}:${entry.movieId}`, entry]),
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      {movieErrorMessage ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-600 dark:text-red-200">
          {movieErrorMessage}
        </div>
      ) : null}
      {searchErrorMessage ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-700 dark:text-amber-200">
          {searchErrorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="grid h-full min-h-96 place-items-center">
          <Loader2 className="animate-spin text-[var(--mac-accent)]" size={28} />
        </div>
      ) : movies.length ? (
        <div className="grid gap-x-4 gap-y-5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${posterSize}px, 1fr))` }}>
          {movies.map((movie, index) => {
            const progress = progressById.get(`${movie.type}:${movie.id}`)
            const inWatchlist = watchlistIds?.has(`${movie.type}:${movie.id}`)
            const isFocused = focusedMovieIndex === index
            return (
              <div key={movie.id} className="group relative min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectMovie(movie)}
                  className="w-full rounded-lg text-left outline-none"
                >
                  <div
                    className={`aspect-[2/3] overflow-hidden rounded-lg border bg-[var(--mac-control)] shadow-sm transition ${
                      selectedMovieId === movie.id || isFocused
                        ? 'border-[var(--mac-accent)] ring-2 ring-[var(--mac-accent)]/30'
                        : 'border-[var(--mac-border)] group-hover:border-[var(--mac-border-strong)]'
                    }`}
                  >
                    {movie.poster ? (
                      <img
                        src={movie.poster}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[var(--mac-tertiary)]">
                        <Star size={20} />
                      </div>
                    )}
                    {progress && catalogId === 'continue' ? (
                      <div className="absolute inset-x-2 bottom-10 h-1 overflow-hidden rounded-full bg-black/40">
                        <div
                          className="h-full rounded-full bg-[var(--mac-accent)]"
                          style={{ width: `${progressPercent(progress)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 min-h-12 px-1">
                    <div className="line-clamp-2 text-[13px] font-medium leading-[17px]">{movie.name}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--mac-secondary)]">
                      <span>
                        {catalogId === 'continue' && progress
                          ? `${formatProgressLabel(progress) || movie.releaseInfo || 'Resume'}`
                          : showYears
                            ? movie.releaseInfo ?? 'Movie'
                            : ''}
                      </span>
                      {showRatings && movie.imdbRating ? (
                        <span className="inline-flex items-center gap-1">
                          <Star size={11} fill="currentColor" />
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
                    className={`absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-black/20 bg-black/55 text-white transition hover:bg-black/75 ${
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

          {!shouldRemoteSearch && hasMoreMovies ? <div ref={loadMoreRef} className="h-10" /> : null}
        </div>
      ) : (
        <div className="grid h-full min-h-96 place-items-center px-6 text-center text-[13px] leading-5 text-[var(--mac-secondary)]">
          {catalogId === 'watchlist'
            ? 'Your watchlist is empty. Use the heart icon on any title to save it here.'
            : catalogId === 'continue'
              ? 'Nothing to continue yet. Start watching something and your progress will show up here.'
              : 'No movies match the current search and filters.'}
        </div>
      )}

      {loadingMore ? (
        <div className="grid h-12 place-items-center">
          <Loader2 className="animate-spin text-[var(--mac-accent)]" size={20} />
        </div>
      ) : null}
    </div>
  )
}
