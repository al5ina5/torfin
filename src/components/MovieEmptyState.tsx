import { appRouteToUrl, browseRoute, withModal } from '../lib/app-routes'
import { isLibraryCatalog } from '../lib/movies'
import { AppLink } from './AppLink'

type MovieEmptyStateProps = {
  catalogId?: string
  onClearFilters?: () => void
  onOpenSettings?: () => void
  onBrowseTrending?: () => void
}

function emptyMessage(catalogId?: string) {
  if (catalogId === 'watchlist') {
    return 'Your watchlist is empty. Use the heart icon on any title to save it here, or import favorites from Jellyfin in Settings.'
  }
  if (catalogId === 'continue') {
    return 'Nothing to continue yet. Start watching something and your progress will show up here.'
  }
  if (catalogId === 'recent') {
    return 'Titles you open will appear here. Browse Trending to get started.'
  }
  return 'No movies match the current search and filters.'
}

export function MovieEmptyState({ catalogId, onClearFilters, onOpenSettings, onBrowseTrending }: MovieEmptyStateProps) {
  const showClearFilters = Boolean(onClearFilters) && !isLibraryCatalog(catalogId ?? '')

  return (
    <div className="movie-empty-enter flex min-h-full flex-1 items-center justify-center px-6 py-12">
      <div className="max-w-sm text-center">
        <p className="text-[13px] leading-5 text-[var(--mac-secondary)]">{emptyMessage(catalogId)}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {showClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
            >
              Clear filters
            </button>
          ) : null}
          {catalogId === 'watchlist' && onOpenSettings ? (
            <AppLink
              href={appRouteToUrl(withModal(browseRoute('movie', 'trending'), { kind: 'settings', tab: 'general' }))}
              onNavigate={onOpenSettings}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
            >
              Open settings
            </AppLink>
          ) : null}
          {(catalogId === 'continue' || catalogId === 'recent') && onBrowseTrending ? (
            <AppLink
              href={appRouteToUrl(browseRoute('movie', 'trending'))}
              onNavigate={onBrowseTrending}
              className="h-8 rounded-md bg-[var(--mac-accent)] px-3 text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              Browse trending
            </AppLink>
          ) : null}
        </div>
      </div>
    </div>
  )
}
