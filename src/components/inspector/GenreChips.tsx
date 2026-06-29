import { filterGenres } from '../../lib/genres'

type GenreChipsProps = {
  genres: string[]
  onBrowseGenre?: (genre: string) => void
}

function isBrowsableGenre(genre: string) {
  return filterGenres.some((entry) => entry.toLowerCase() === genre.toLowerCase())
}

export function GenreChips({ genres, onBrowseGenre }: GenreChipsProps) {
  if (!genres.length) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {genres.map((genre) =>
        onBrowseGenre && isBrowsableGenre(genre) ? (
          <button
            key={genre}
            type="button"
            onClick={() => onBrowseGenre(genre)}
            className="rounded-full border border-[var(--mac-accent)]/25 bg-[var(--mac-accent)]/8 px-2.5 py-1 text-[11px] font-semibold text-[var(--mac-accent)] transition hover:bg-[var(--mac-accent)]/15"
          >
            {genre}
          </button>
        ) : (
          <span
            key={genre}
            className="rounded-full border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--mac-secondary)]"
          >
            {genre}
          </span>
        ),
      )}
    </div>
  )
}
