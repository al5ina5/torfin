import { Heart, Loader2, Star } from 'lucide-react'

import { formatProgressLabel, loadPlaybackProgress, progressPercent } from '../lib/playback-progress'
import type { Movie } from '../types'

type MovieListProps = {
  movies: Movie[]
  selectedMovieId?: string
  focusedMovieIndex?: number
  catalogId?: string
  watchlistIds?: Set<string>
  showYears: boolean
  showRatings: boolean
  loading: boolean
  movieErrorMessage?: string
  searchErrorMessage?: string
  onSelectMovie: (movie: Movie) => void
  onToggleWatchlist?: (movie: Movie) => void
}

export function MovieList({
  movies,
  selectedMovieId,
  focusedMovieIndex = -1,
  catalogId,
  watchlistIds,
  showYears,
  showRatings,
  loading,
  movieErrorMessage = '',
  searchErrorMessage = '',
  onSelectMovie,
  onToggleWatchlist,
}: MovieListProps) {
  const progressById = new Map(
    loadPlaybackProgress().map((entry) => [`${entry.type}:${entry.movieId}`, entry]),
  )

  if (loading) {
    return (
      <div className="grid h-full min-h-96 place-items-center">
        <Loader2 className="animate-spin text-[var(--mac-accent)]" size={28} />
      </div>
    )
  }

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

      {movies.length ? (
        <div className="space-y-2">
          {movies.map((movie, index) => {
            const progress = progressById.get(`${movie.type}:${movie.id}`)
            const inWatchlist = watchlistIds?.has(`${movie.type}:${movie.id}`)
            const isFocused = focusedMovieIndex === index
            return (
              <div
                key={`${movie.type}:${movie.id}`}
                className={`group flex items-center gap-3 rounded-lg border bg-[var(--mac-surface)] p-2 transition ${
                  selectedMovieId === movie.id || isFocused
                    ? 'border-[var(--mac-accent)] ring-2 ring-[var(--mac-accent)]/20'
                    : 'border-[var(--mac-border)] hover:border-[var(--mac-border-strong)]'
                }`}
              >
                <button type="button" onClick={() => onSelectMovie(movie)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)]">
                    {movie.poster ? (
                      <img src={movie.poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full place-items-center text-[var(--mac-tertiary)]">
                        <Star size={16} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{movie.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--mac-secondary)]">
                      {catalogId === 'continue' && progress ? <span>{formatProgressLabel(progress)}</span> : null}
                      {showYears && movie.releaseInfo ? <span>{movie.releaseInfo}</span> : null}
                      {movie.genres?.slice(0, 2).map((genre) => (
                        <span key={genre}>{genre}</span>
                      ))}
                      {showRatings && movie.imdbRating ? (
                        <span className="inline-flex items-center gap-1">
                          <Star size={11} fill="currentColor" />
                          {movie.imdbRating}
                        </span>
                      ) : null}
                    </div>
                    {progress && catalogId === 'continue' ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--mac-control)]">
                        <div className="h-full rounded-full bg-[var(--mac-accent)]" style={{ width: `${progressPercent(progress)}%` }} />
                      </div>
                    ) : null}
                  </div>
                </button>
                {onToggleWatchlist ? (
                  <button
                    type="button"
                    onClick={() => onToggleWatchlist(movie)}
                    className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)]"
                    title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    <Heart size={14} fill={inWatchlist ? 'currentColor' : 'none'} />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid h-full min-h-96 place-items-center px-6 text-center text-[13px] leading-5 text-[var(--mac-secondary)]">
          {catalogId === 'watchlist'
            ? 'Your watchlist is empty.'
            : catalogId === 'continue'
              ? 'Nothing to continue yet.'
              : catalogId === 'recent'
                ? 'Titles you open will appear here.'
                : 'No movies match the current search and filters.'}
        </div>
      )}
    </div>
  )
}
