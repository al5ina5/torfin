import { Download, Loader2 } from 'lucide-react'

import type { SeriesMetaEpisode } from '../../types'

type EpisodePickerProps = {
  episodeOptions: SeriesMetaEpisode[]
  loadingEpisodes: boolean
  episodeLoadError: string
  selectedSeason: number | null
  selectedEpisode: number | null
  onSeasonChange: (season: number) => void
  onEpisodeChange: (episode: number) => void
  onDownloadSeason?: () => void
  batchDownloading?: boolean
}

function formatEpisodeDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function EpisodePicker({
  episodeOptions,
  loadingEpisodes,
  episodeLoadError,
  selectedSeason,
  selectedEpisode,
  onSeasonChange,
  onEpisodeChange,
  onDownloadSeason,
  batchDownloading,
}: EpisodePickerProps) {
  const seasonOptions = [...new Set(episodeOptions.map((entry) => entry.season))].sort((a, b) => a - b)
  const episodesForSeason = episodeOptions.filter((entry) => entry.season === selectedSeason)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">Episodes</p>
        {onDownloadSeason ? (
          <button
            type="button"
            disabled={batchDownloading || !episodesForSeason.length}
            onClick={onDownloadSeason}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[11px] font-semibold transition hover:bg-[var(--mac-control-hover)] disabled:opacity-50"
          >
            {batchDownloading ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />}
            Download S{selectedSeason}
          </button>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {loadingEpisodes ? (
          <span className="text-[12px] text-[var(--mac-secondary)]">Loading seasons…</span>
        ) : seasonOptions.length ? (
          seasonOptions.map((season) => {
            const active = selectedSeason === season
            return (
              <button
                key={season}
                type="button"
                onClick={() => onSeasonChange(season)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? 'border-[var(--mac-accent)] bg-[var(--mac-accent)] text-white'
                    : 'border-[var(--mac-border)] bg-[var(--mac-surface)] text-[var(--mac-secondary)] hover:bg-[var(--mac-control)]'
                }`}
              >
                Season {season}
              </button>
            )
          })
        ) : (
          <span className="text-[12px] text-[var(--mac-secondary)]">{episodeLoadError || 'No seasons found'}</span>
        )}
      </div>

      <div className="space-y-2">
        {episodesForSeason.map((entry) => {
          const active = selectedEpisode === entry.episode
          const airDate = formatEpisodeDate(entry.released)
          return (
            <button
              key={`${entry.season}-${entry.episode}`}
              type="button"
              onClick={() => onEpisodeChange(entry.episode)}
              className={`flex w-full gap-3 rounded-xl border p-2 text-left transition ${
                active
                  ? 'border-[var(--mac-accent)] bg-[var(--mac-accent)]/8'
                  : 'border-[var(--mac-border)] bg-[var(--mac-surface)] hover:bg-[var(--mac-control)]'
              }`}
            >
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)]">
                {entry.thumbnail ? (
                  <img src={entry.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[10px] font-semibold text-[var(--mac-tertiary)]">
                    E{entry.episode}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-accent)]">
                    E{String(entry.episode).padStart(2, '0')}
                  </span>
                  {airDate ? <span className="text-[10px] text-[var(--mac-tertiary)]">{airDate}</span> : null}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-[var(--mac-text)]">
                  {entry.title || `Episode ${entry.episode}`}
                </p>
                {entry.overview ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--mac-secondary)]">{entry.overview}</p>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
