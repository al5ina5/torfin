import type { Movie } from '../../types'

type MetadataFactsProps = {
  movie: Movie
}

type Fact = {
  label: string
  value: string
}

export function MetadataFacts({ movie }: MetadataFactsProps) {
  const facts: Fact[] = [
    movie.releaseInfo ? { label: 'Year', value: movie.releaseInfo } : null,
    movie.released ? { label: 'Released', value: movie.released } : null,
    movie.dvdRelease ? { label: 'DVD', value: movie.dvdRelease } : null,
    movie.runtime ? { label: 'Runtime', value: movie.runtime } : null,
    movie.status ? { label: 'Status', value: movie.status } : null,
    movie.country ? { label: 'Country', value: movie.country } : null,
  ].filter((entry): entry is Fact => Boolean(entry))

  if (!facts.length) return null

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">{fact.label}</div>
          <div className="mt-0.5 text-[12px] font-medium leading-4 text-[var(--mac-text)]">{fact.value}</div>
        </div>
      ))}
    </div>
  )
}
