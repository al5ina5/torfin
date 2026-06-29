import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Clapperboard, Clock, Download, Film, Heart, History, Loader2, Pause, Scale, Settings2, SlidersHorizontal, TriangleAlert, Tv } from 'lucide-react'

import { appRouteToUrl, browseRoute, presetRoute, withModal } from '../lib/app-routes'
import { builtInFilterPresets, FEATURED_PRESET_COUNT, pickFeaturedPresets, presetRouteSlug } from '../lib/filter-presets'
import { topGenres } from '../lib/genres'
import { catalogOptions, isLibraryCatalog, libraryCatalogOptions } from '../lib/movies'
import type { DownloadSidebarPhase, DownloadSidebarSummary } from '../lib/downloads'
import type { ContentType, FilterPreset, MovieFilters } from '../types'
import { AppDrawer } from './AppDrawer'
import { AppLink } from './AppLink'
import { FocusZone } from './FocusZone'

type SidebarProps = {
  contentType: ContentType
  catalogId: string
  watchlistCount: number
  continueCount: number
  recentCount: number
  preferencesOpen: boolean
  downloadsOpen: boolean
  legalOpen: boolean
  showDownloads: boolean
  downloadSummary: DownloadSidebarSummary
  onContentTypeChange: (type: ContentType) => void
  onCatalogChange: (id: string) => void
  onOpenPreferences: () => void
  onOpenDownloads: () => void
  onOpenLegal: () => void
  customFilterPresets: FilterPreset[]
  activePresetId?: string
  movieFilters: MovieFilters
  onApplyFilterPreset: (preset: FilterPreset) => void
  mobile?: boolean
  open?: boolean
  onClose?: () => void
}

const groups = ['Library', 'Now', 'Genres']

const downloadPhaseLabels: Record<Exclude<DownloadSidebarPhase, 'idle'>, string> = {
  starting: 'Starting',
  queued: 'Queued',
  downloading: 'Downloading',
  paused: 'Paused',
  stalled: 'Stalled',
}

function DownloadActivityIcon({ phase }: { phase: DownloadSidebarPhase }) {
  switch (phase) {
    case 'downloading':
    case 'starting':
      return <Loader2 className="animate-spin text-[var(--mac-accent)]" size={15} />
    case 'paused':
      return <Pause className="text-[var(--mac-secondary)]" size={15} />
    case 'stalled':
      return <TriangleAlert className="text-amber-500" size={15} />
    case 'queued':
      return <Clock className="text-[var(--mac-secondary)]" size={15} />
    default:
      return <Download size={15} />
  }
}

function SidebarContent({
  contentType,
  catalogId,
  watchlistCount,
  continueCount,
  recentCount,
  preferencesOpen,
  downloadsOpen,
  legalOpen,
  showDownloads,
  downloadSummary,
  onContentTypeChange,
  onCatalogChange,
  onOpenPreferences,
  onOpenDownloads,
  onOpenLegal,
  customFilterPresets,
  activePresetId,
  movieFilters,
  onApplyFilterPreset,
  mobile = false,
  onClose,
}: SidebarProps) {
  const allOptions = [...libraryCatalogOptions, ...catalogOptions]
  const topGenreSet = new Set<string>(topGenres)
  const [genresExpanded, setGenresExpanded] = useState(false)
  const [presetsExpanded, setPresetsExpanded] = useState(true)
  const [featuredPresets] = useState(() => pickFeaturedPresets(builtInFilterPresets, FEATURED_PRESET_COUNT))
  const allPresets = [...builtInFilterPresets, ...customFilterPresets]
  const visiblePresets = presetsExpanded
    ? [...allPresets].sort((left, right) => left.name.localeCompare(right.name))
    : featuredPresets

  useEffect(() => {
    const selected = allOptions.find((option) => option.id === catalogId)
    if (selected?.group === 'Genres' && !topGenreSet.has(selected.label)) {
      setGenresExpanded(true)
    }
  }, [catalogId])

  const { phase, inProgressCount, topProgress } = downloadSummary
  const progressPercent = Math.round(topProgress * 100)
  const showDownloadActivity = phase !== 'idle'
  const showProgressBar = phase === 'downloading' || phase === 'paused' || phase === 'stalled' || phase === 'queued'
  const showProgressPercent = phase === 'downloading' || phase === 'paused'

  function handleNavigate(action: () => void) {
    action()
    if (mobile) onClose?.()
  }

  return (
    <FocusZone zone="sidebar" className="flex min-h-0 flex-1 flex-col">
      {!mobile ? (
        <div className="px-4 pb-3 pt-5">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-[var(--mac-accent)] text-[var(--mac-accent-text)] shadow-sm">
              <Clapperboard size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[13px] font-semibold leading-4 tracking-normal">Torfin</h1>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`px-4 ${mobile ? 'pb-2' : 'pb-3'}`}>
        <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] p-0.5">
          <AppLink
            href={appRouteToUrl(browseRoute('movie', catalogId))}
            onNavigate={() => handleNavigate(() => onContentTypeChange('movie'))}
            className={`flex h-7 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
              contentType === 'movie'
                ? 'bg-[var(--mac-elevated)] text-[var(--mac-text)]'
                : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control-hover)]'
            }`}
          >
            <Film size={13} />
            Movies
          </AppLink>
          <AppLink
            href={appRouteToUrl(browseRoute('series', catalogId))}
            onNavigate={() => handleNavigate(() => onContentTypeChange('series'))}
            className={`flex h-7 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
              contentType === 'series'
                ? 'bg-[var(--mac-elevated)] text-[var(--mac-text)]'
                : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control-hover)]'
            }`}
          >
            <Tv size={13} />
            Series
          </AppLink>
        </div>
      </div>

      <nav className="modal-scroll min-h-0 flex-1 px-2">
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">
              {group}
            </div>
            <div className="space-y-1">
              {(group === 'Genres'
                ? (genresExpanded
                    ? allOptions
                        .filter((option) => option.group === 'Genres')
                        .sort((left, right) => left.label.localeCompare(right.label))
                    : allOptions.filter(
                        (option) => option.group === 'Genres' && topGenreSet.has(option.label),
                      ))
                : allOptions.filter((option) => option.group === group)
              ).map((option) => {
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
                    <AppLink
                      key={option.id}
                      href={appRouteToUrl(browseRoute(contentType, option.id))}
                      onNavigate={() => handleNavigate(() => onCatalogChange(option.id))}
                      className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium transition ${
                        catalogId === option.id
                          ? 'bg-[var(--mac-accent-soft)] text-[var(--mac-accent-soft-text)]'
                          : 'text-[var(--mac-text)] hover:bg-[var(--mac-control)]'
                      }`}
                    >
                      <Icon size={15} />
                      <span className="truncate">{option.label}</span>
                      {count > 0 ? (
                        <span className="ml-auto text-[10px] font-semibold opacity-80">{count}</span>
                      ) : null}
                    </AppLink>
                  )
                })}
              {group === 'Genres' ? (
                <button
                  type="button"
                  onClick={() => setGenresExpanded((expanded) => !expanded)}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] font-medium text-[var(--mac-secondary)] transition hover:bg-[var(--mac-control)] hover:text-[var(--mac-text)]"
                >
                  {genresExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{genresExpanded ? 'Show less' : 'Show more'}</span>
                </button>
              ) : null}
            </div>
          </div>
        ))}

        <div className="mb-4">
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">
            Presets
          </div>
          <div className="space-y-1">
            {visiblePresets.map((preset) => {
              const slug = presetRouteSlug(preset)
              const active = activePresetId ? activePresetId === slug : (Object.keys(movieFilters) as (keyof MovieFilters)[]).every(
                (key) => movieFilters[key] === preset.filters[key],
              )
              return (
                <AppLink
                  key={preset.id}
                  href={appRouteToUrl(presetRoute(contentType, slug))}
                  onNavigate={() => handleNavigate(() => onApplyFilterPreset(preset))}
                  className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium transition ${
                    active
                      ? 'bg-[var(--mac-accent-soft)] text-[var(--mac-accent-soft-text)]'
                      : 'text-[var(--mac-text)] hover:bg-[var(--mac-control)]'
                  }`}
                >
                  <SlidersHorizontal size={15} />
                  <span className="truncate">{preset.name}</span>
                </AppLink>
              )
            })}
            {allPresets.length > FEATURED_PRESET_COUNT ? (
              <button
                type="button"
                onClick={() => setPresetsExpanded((expanded) => !expanded)}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] font-medium text-[var(--mac-secondary)] transition hover:bg-[var(--mac-control)] hover:text-[var(--mac-text)]"
              >
                {presetsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{presetsExpanded ? 'Show less' : 'Show more'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-[var(--mac-divider,var(--mac-border))] p-2">
        {showDownloads ? (
        <AppLink
          href={appRouteToUrl(withModal(browseRoute(contentType, catalogId), { kind: 'downloads' }))}
          onNavigate={() => handleNavigate(onOpenDownloads)}
          aria-label="Open download queue"
          className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left transition ${
            downloadsOpen ? 'bg-[var(--mac-control-hover)]' : 'hover:bg-[var(--mac-control)]'
          }`}
        >
          <span className="flex h-6 items-center gap-2 text-[13px] font-medium">
            {showDownloadActivity ? <DownloadActivityIcon phase={phase} /> : <Download size={15} />}
            <span className="min-w-0 flex-1 truncate">Downloads</span>
            {inProgressCount > 0 ? (
              <span className="rounded-full bg-[var(--mac-accent)] px-1.5 text-[10px] font-bold leading-4 text-[var(--mac-accent-text)]">
                {inProgressCount}
              </span>
            ) : null}
            {showProgressPercent ? (
              <span className="text-[10px] font-semibold tabular-nums text-[var(--mac-secondary)]">{progressPercent}%</span>
            ) : phase !== 'idle' ? (
              <span className="text-[10px] font-semibold text-[var(--mac-secondary)]">{downloadPhaseLabels[phase]}</span>
            ) : null}
          </span>
          {showProgressBar ? (
            <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-[var(--mac-border)]">
              <span
                className={`block h-full rounded-full transition-[width] duration-150 ease-linear ${
                  phase === 'stalled'
                    ? 'bg-amber-500'
                    : phase === 'paused'
                      ? 'bg-[var(--mac-secondary)]'
                      : 'bg-[var(--mac-accent)]'
                }`}
                style={{ width: `${Math.max(progressPercent, 2)}%` }}
              />
            </span>
          ) : null}
        </AppLink>
        ) : null}
        <AppLink
          href={appRouteToUrl(withModal(browseRoute(contentType, catalogId), { kind: 'settings', tab: 'general' }))}
          onNavigate={() => handleNavigate(onOpenPreferences)}
          className={`mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium transition ${
            preferencesOpen ? 'bg-[var(--mac-control-hover)]' : 'hover:bg-[var(--mac-control)]'
          }`}
        >
          <Settings2 size={15} />
          <span className="truncate">Settings</span>
        </AppLink>
        <AppLink
          href={appRouteToUrl(withModal(browseRoute(contentType, catalogId), { kind: 'legal' }))}
          onNavigate={() => handleNavigate(onOpenLegal)}
          className={`mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium transition ${
            legalOpen ? 'bg-[var(--mac-control-hover)]' : 'hover:bg-[var(--mac-control)]'
          }`}
        >
          <Scale size={15} />
          <span className="truncate">Legal</span>
        </AppLink>
      </div>
    </FocusZone>
  )
}

export function Sidebar({
  mobile = false,
  open = false,
  onClose,
  ...props
}: SidebarProps) {
  if (mobile) {
    return (
      <AppDrawer
        open={open}
        title="Torfin"
        icon={<Clapperboard size={15} />}
        onClose={onClose ?? (() => {})}
        zClassName="z-40"
        bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
        titleId="app-sidebar-title"
        focusZone="sidebar"
      >
        <SidebarContent mobile onClose={onClose} {...props} />
      </AppDrawer>
    )
  }

  return (
    <aside className="app-sidebar-desktop mac-sidebar flex min-h-0 flex-col">
      <SidebarContent {...props} />
    </aside>
  )
}

export { isLibraryCatalog }
