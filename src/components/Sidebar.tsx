import { Clapperboard, Clock, Download, Film, Heart, History, Loader2, Settings2, Tv, X } from 'lucide-react'

import { useSwipeDismiss } from '../hooks/useSwipeDismiss'
import { catalogOptions, isLibraryCatalog, libraryCatalogOptions } from '../lib/movies'
import type { ContentType } from '../types'

type DownloadSidebarSummary = {
  activeCount: number
  topProgress: number
  resolvingCount: number
}

type SidebarProps = {
  contentType: ContentType
  catalogId: string
  activePluginCount: number
  watchlistCount: number
  continueCount: number
  recentCount: number
  preferencesOpen: boolean
  downloadsOpen: boolean
  downloadSummary: DownloadSidebarSummary
  onContentTypeChange: (type: ContentType) => void
  onCatalogChange: (id: string) => void
  onOpenPreferences: () => void
  onOpenDownloads: () => void
  onResetSelection: () => void
  mobile?: boolean
  open?: boolean
  onClose?: () => void
}

const groups = ['Library', 'Now', 'Genres']

export function Sidebar({
  contentType,
  catalogId,
  activePluginCount,
  watchlistCount,
  continueCount,
  recentCount,
  preferencesOpen,
  downloadsOpen,
  downloadSummary,
  onContentTypeChange,
  onCatalogChange,
  onOpenPreferences,
  onOpenDownloads,
  onResetSelection,
  mobile = false,
  open = false,
  onClose,
}: SidebarProps) {
  const allOptions = [...libraryCatalogOptions, ...catalogOptions]
  const swipeDismiss = useSwipeDismiss(() => onClose?.(), 'left')
  const { activeCount, topProgress, resolvingCount } = downloadSummary
  const progressPercent = Math.round(topProgress * 100)
  const showDownloadActivity = activeCount > 0 || resolvingCount > 0

  function handleNavigate(action: () => void) {
    action()
    if (mobile) onClose?.()
  }

  const asideClass = mobile
    ? `app-sidebar-drawer mac-sidebar flex min-h-0 flex-col border-r ${open ? 'is-open' : ''}`
    : 'app-sidebar-desktop mac-sidebar flex min-h-0 flex-col border-r'

  return (
    <aside
      className={asideClass}
      aria-hidden={mobile ? !open : undefined}
      {...(mobile ? swipeDismiss : {})}
    >
      <div className="px-4 pb-3 pt-5">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-[var(--mac-accent)] text-[var(--mac-accent-text)] shadow-sm">
            <Clapperboard size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[13px] font-semibold leading-4 tracking-normal">Torfin</h1>
            <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">{activePluginCount} plugins active</p>
          </div>
          {mobile ? (
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] transition hover:bg-[var(--mac-control-hover)]"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-2 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] p-0.5">
          <button
            type="button"
            onClick={() => handleNavigate(() => onContentTypeChange('movie'))}
            className={`flex h-7 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
              contentType === 'movie'
                ? 'bg-[var(--mac-elevated)] text-[var(--mac-text)] shadow-sm'
                : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control-hover)]'
            }`}
          >
            <Film size={13} />
            Movies
          </button>
          <button
            type="button"
            onClick={() => handleNavigate(() => onContentTypeChange('series'))}
            className={`flex h-7 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
              contentType === 'series'
                ? 'bg-[var(--mac-elevated)] text-[var(--mac-text)] shadow-sm'
                : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control-hover)]'
            }`}
          >
            <Tv size={13} />
            TV
          </button>
        </div>
      </div>

      <nav className="modal-scroll flex-1 px-2">
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">
              {group}
            </div>
            <div className="space-y-1">
              {allOptions
                .filter((option) => option.group === group)
                .map((option) => {
                  const count = option.id === 'watchlist'
                    ? watchlistCount
                    : option.id === 'continue'
                      ? continueCount
                      : option.id === 'recent'
                        ? recentCount
                        : 0
                  const Icon = option.id === 'watchlist'
                    ? Heart
                    : option.id === 'continue'
                      ? History
                      : option.id === 'recent'
                        ? Clock
                        : Film
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleNavigate(() => {
                        onCatalogChange(option.id)
                        onResetSelection()
                      })}
                      className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium transition ${
                        catalogId === option.id
                          ? 'bg-[var(--mac-accent)] text-[var(--mac-accent-text)]'
                          : 'text-[var(--mac-text)] hover:bg-[var(--mac-control)]'
                      }`}
                    >
                      <Icon size={15} />
                      <span className="truncate">{option.label}</span>
                      {count > 0 ? (
                        <span className="ml-auto text-[10px] font-semibold opacity-80">{count}</span>
                      ) : null}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--mac-border)] p-2">
        <button
          type="button"
          onClick={() => handleNavigate(onOpenPreferences)}
          className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium transition ${
            preferencesOpen ? 'bg-[var(--mac-control-hover)]' : 'hover:bg-[var(--mac-control)]'
          }`}
        >
          <Settings2 size={15} />
          <span className="truncate">Settings</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavigate(onOpenDownloads)}
          className={`mt-1 flex w-full flex-col rounded-md px-2 py-1.5 text-left transition ${
            downloadsOpen ? 'bg-[var(--mac-control-hover)]' : 'hover:bg-[var(--mac-control)]'
          }`}
        >
          <span className="flex h-6 items-center gap-2 text-[13px] font-medium">
            {showDownloadActivity && activeCount > 0 ? (
              <Loader2 className="animate-spin text-[var(--mac-accent)]" size={15} />
            ) : (
              <Download size={15} />
            )}
            <span className="min-w-0 flex-1 truncate">Downloads</span>
            {activeCount > 0 ? (
              <span className="rounded-full bg-[var(--mac-accent)] px-1.5 text-[10px] font-bold leading-4 text-[var(--mac-accent-text)]">
                {activeCount}
              </span>
            ) : resolvingCount > 0 ? (
              <span className="text-[10px] font-semibold text-[var(--mac-secondary)]">Starting</span>
            ) : null}
            {activeCount > 0 ? (
              <span className="text-[10px] font-semibold tabular-nums text-[var(--mac-secondary)]">{progressPercent}%</span>
            ) : null}
          </span>
          {activeCount > 0 ? (
            <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-[var(--mac-border)]">
              <span
                className="block h-full rounded-full bg-[var(--mac-accent)] transition-[width] duration-150 ease-linear"
                style={{ width: `${Math.max(progressPercent, 2)}%` }}
              />
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  )
}

export { isLibraryCatalog }
