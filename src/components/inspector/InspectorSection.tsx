import type { ReactNode } from 'react'

type InspectorSectionProps = {
  title: string
  children: ReactNode
  className?: string
}

export function InspectorSection({ title, children, className = '' }: InspectorSectionProps) {
  return (
    <section className={className}>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">{title}</h3>
      {children}
    </section>
  )
}
