import { appRouteToUrl, searchRoute } from '../../lib/app-routes'
import type { ContentType } from '../../types'
import { AppLink } from '../AppLink'

type PersonCreditsProps = {
  label: string
  names: string[]
  contentType: ContentType
  onSearchPerson?: (name: string) => void
}

export function PersonCredits({ label, names, contentType, onSearchPerson }: PersonCreditsProps) {
  if (!names.length) return null

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {names.map((name) =>
          onSearchPerson ? (
            <AppLink
              key={name}
              href={appRouteToUrl(searchRoute(contentType, name))}
              onNavigate={() => onSearchPerson(name)}
              className="rounded-full border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--mac-text)] transition hover:border-[var(--mac-accent)] hover:bg-[var(--mac-control)]"
            >
              {name}
            </AppLink>
          ) : (
            <span
              key={name}
              className="rounded-full border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--mac-secondary)]"
            >
              {name}
            </span>
          ),
        )}
      </div>
    </div>
  )
}
