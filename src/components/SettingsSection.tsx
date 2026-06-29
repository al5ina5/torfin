import type { ReactNode } from 'react'

export function SettingsSection({
  title,
  description,
  children,
  first = false,
}: {
  title: string
  description?: string
  children: ReactNode
  first?: boolean
}) {
  return (
    <section className={first ? 'space-y-3' : 'space-y-3 border-t border-[var(--mac-border)] pt-5'}>
      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--mac-secondary)]">{title}</h3>
        {description ? <p className="mt-1 text-[11px] leading-4 text-[var(--mac-secondary)]">{description}</p> : null}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

export function SettingsHint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">{children}</p>
}

export function SettingsToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2.5 text-[13px]">
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint ? <SettingsHint>{hint}</SettingsHint> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--mac-accent)]"
      />
    </label>
  )
}

export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2.5">
      <label className="grid gap-2 text-[13px]">
        <span>{label}</span>
        {hint ? <SettingsHint>{hint}</SettingsHint> : null}
        {children}
      </label>
    </div>
  )
}

export function SettingsSelect({
  value,
  onChange,
  children,
  className = 'h-8 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none',
}: {
  value: string | number
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={className}>
      {children}
    </select>
  )
}

export function SettingsRange({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2.5 text-[13px]">
      <span>{label}</span>
      <span className="text-[12px] tabular-nums text-[var(--mac-secondary)]">
        {value}
        {suffix}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="col-span-2 accent-[var(--mac-accent)]"
      />
    </label>
  )
}
