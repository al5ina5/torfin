import type { TitlePopularities } from '../../types'

type PopularityStatsProps = {
  popularities: TitlePopularities
}

function formatScore(value: number) {
  if (value >= 100) return String(Math.round(value))
  if (value >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

export function PopularityStats({ popularities }: PopularityStatsProps) {
  const items = [
    popularities.trakt != null ? { label: 'Trakt', value: formatScore(popularities.trakt) } : null,
    popularities.moviedb != null ? { label: 'TMDB', value: formatScore(popularities.moviedb) } : null,
    popularities.stremio != null ? { label: 'Stremio', value: formatScore(popularities.stremio) } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry))

  if (!items.length) return null

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-center"
        >
          <div className="text-[15px] font-semibold leading-5 text-[var(--mac-text)]">{item.value}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--mac-tertiary)]">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
