import { SlidersHorizontal } from 'lucide-react'

import { filterGenres, filterYears } from '../lib/movies'
import type { MovieFilters } from '../types'
import { AppModal } from './AppModal'

type FiltersModalProps = {
  open: boolean
  filters: MovieFilters
  onClose: () => void
  onChange: (next: MovieFilters) => void
  onReset: () => void
  onSavePreset: (name: string) => void
}

export function FiltersModal({
  open,
  filters,
  onClose,
  onChange,
  onReset,
  onSavePreset,
}: FiltersModalProps) {
  return (
    <AppModal
      open={open}
      title="Filters"
      icon={<SlidersHorizontal size={15} />}
      onClose={onClose}
      className="w-[min(620px,calc(100vw-32px))]"
      bodyClassName="modal-scroll app-screen-body space-y-4"
    >
      <div>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt('Preset name', 'My filters')
            if (name?.trim()) onSavePreset(name.trim())
          }}
          className="h-7 rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2.5 text-[11px] font-semibold"
        >
          Save current filters
        </button>
      </div>

      <div className="grid gap-3">
        <label className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-[12px]">
          <span>Catalog</span>
          <select
            value={filters.apiCatalog}
            onChange={(event) => onChange({ ...filters, apiCatalog: event.target.value as MovieFilters['apiCatalog'] })}
            className="h-8 min-w-0 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          >
            <option value="">Current sidebar list</option>
            <option value="top">Popular</option>
            <option value="imdbRating">Featured by IMDb</option>
            <option value="year">New by year</option>
          </select>
        </label>

        <label className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-[12px]">
          <span>Genre</span>
          <select
            value={filters.genre}
            onChange={(event) => onChange({ ...filters, genre: event.target.value })}
            disabled={filters.apiCatalog === 'year' || Boolean(filters.releaseYear)}
            className="h-8 min-w-0 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)] disabled:text-[var(--mac-tertiary)]"
          >
            <option value="">Any</option>
            {filterGenres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>

        <label className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-[12px]">
          <span>API Year</span>
          <select
            value={filters.releaseYear}
            onChange={(event) =>
              onChange({
                ...filters,
                releaseYear: event.target.value,
                apiCatalog: event.target.value ? 'year' : filters.apiCatalog,
              })
            }
            className="h-8 min-w-0 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          >
            <option value="">Any</option>
            {filterYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 text-[12px]">
          <span>Year Range</span>
          <input
            value={filters.yearFrom}
            onChange={(event) => onChange({ ...filters, yearFrom: event.target.value.replace(/\D/g, '').slice(0, 4) })}
            inputMode="numeric"
            placeholder="From"
            className="h-8 min-w-0 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          />
          <input
            value={filters.yearTo}
            onChange={(event) => onChange({ ...filters, yearTo: event.target.value.replace(/\D/g, '').slice(0, 4) })}
            inputMode="numeric"
            placeholder="To"
            className="h-8 min-w-0 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          />
        </div>

        <label className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-[12px]">
          <span>IMDb Rating</span>
          <select
            value={filters.minRating}
            onChange={(event) => onChange({ ...filters, minRating: event.target.value })}
            className="h-8 min-w-0 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          >
            <option value="">Any</option>
            <option value="6">6+</option>
            <option value="7">7+</option>
            <option value="8">8+</option>
            <option value="9">9+</option>
          </select>
        </label>

        <label className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-[12px]">
          <span>Sort</span>
          <select
            value={filters.sortBy}
            onChange={(event) => onChange({ ...filters, sortBy: event.target.value as MovieFilters['sortBy'] })}
            className="h-8 min-w-0 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          >
            <option value="catalog">Catalog order</option>
            <option value="ratingDesc">Rating high to low</option>
            <option value="yearDesc">Newest first</option>
            <option value="yearAsc">Oldest first</option>
            <option value="titleAsc">Title A-Z</option>
          </select>
        </label>
      </div>

      <div className="flex justify-between gap-2 border-t border-[var(--mac-border)] pt-3">
        <button
          type="button"
          onClick={onReset}
          className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md bg-[var(--mac-accent)] px-3 text-[12px] font-semibold text-[var(--mac-accent-text)]"
        >
          Done
        </button>
      </div>
    </AppModal>
  )
}
