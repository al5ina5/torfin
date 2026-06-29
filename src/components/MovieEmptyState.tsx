import { isLibraryCatalog } from '../lib/movies'

function emptyMessage(catalogId?: string) {
  if (catalogId === 'watchlist') {
    return 'Your watchlist is empty. Use the heart icon on any title to save it here.'
  }
  if (catalogId === 'continue') {
    return 'Nothing to continue yet. Start watching something and your progress will show up here.'
  }
  if (catalogId === 'recent') {
    return 'Titles you open will appear here.'
  }
  return 'No movies match the current search and filters.'
}

type MovieEmptyStateProps = {
  catalogId?: string
  onClearFilters?: () => void
}

export function MovieEmptyState({ catalogId, onClearFilters }: MovieEmptyStateProps) {
  const showClearFilters = Boolean(onClearFilters) && !isLibraryCatalog(catalogId ?? '')

  return (
    <div className="movie-empty-enter flex min-h-full flex-1 items-center justify-center px-6 py-12">
      <div className="max-w-sm text-center">
        <p className="text-[13px] leading-5 text-[var(--mac-secondary)]">{emptyMessage(catalogId)}</p>
        {showClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  )
}
