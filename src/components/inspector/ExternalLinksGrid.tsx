import { ExternalLink } from 'lucide-react'

import type { ExternalLink as ExternalLinkItem, ExternalLinkTone } from '../../types'

const toneClasses: Record<ExternalLinkTone, string> = {
  default: 'border-[var(--mac-border)] bg-[var(--mac-surface)] text-[var(--mac-text)] hover:bg-[var(--mac-control-hover)]',
  imdb: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-900 hover:bg-yellow-500/15 dark:text-yellow-100',
  tmdb: 'border-sky-500/35 bg-sky-500/10 text-sky-900 hover:bg-sky-500/15 dark:text-sky-100',
  tvdb: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/15 dark:text-emerald-100',
  trakt: 'border-rose-500/35 bg-rose-500/10 text-rose-900 hover:bg-rose-500/15 dark:text-rose-100',
  letterboxd: 'border-orange-500/35 bg-orange-500/10 text-orange-900 hover:bg-orange-500/15 dark:text-orange-100',
  wiki: 'border-[var(--mac-border)] bg-[var(--mac-surface)] text-[var(--mac-text)] hover:bg-[var(--mac-control-hover)]',
}

type ExternalLinksGridProps = {
  links: ExternalLinkItem[]
}

export function ExternalLinksGrid({ links }: ExternalLinksGridProps) {
  if (!links.length) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          title={link.label}
          className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold transition ${toneClasses[link.tone ?? 'default']}`}
        >
          {link.shortLabel}
          <ExternalLink size={11} className="opacity-70" />
        </a>
      ))}
    </div>
  )
}
