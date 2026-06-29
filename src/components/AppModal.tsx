import type { ReactNode } from 'react'

type AppModalProps = {
  open: boolean
  title: string
  icon?: ReactNode
  children: ReactNode
  onClose: () => void
  className?: string
  bodyClassName?: string
  headerEnd?: ReactNode
  zClassName?: string
}

export function AppModal({
  open,
  title,
  icon,
  children,
  onClose,
  className = '',
  bodyClassName = 'modal-scroll p-5',
  headerEnd,
  zClassName = 'z-50',
}: AppModalProps) {
  if (!open) return null

  return (
    <div className={`app-modal-backdrop fixed inset-0 ${zClassName} bg-black/20 p-4 backdrop-blur-sm`} onClick={onClose}>
      <section className={`mac-elevated flex flex-col overflow-hidden rounded-xl border ${className}`} onClick={(event) => event.stopPropagation()}>
        <header className="mac-toolbar flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="size-3.5 shrink-0 rounded-full bg-[#ff5f57] transition hover:brightness-95"
              title="Close"
            />
            {icon ? <span className="ml-1 shrink-0 text-[var(--mac-secondary)]">{icon}</span> : null}
            <div className="truncate text-[13px] font-semibold">{title}</div>
          </div>
          {headerEnd ? <div className="shrink-0">{headerEnd}</div> : null}
        </header>
        <div className={bodyClassName}>{children}</div>
      </section>
    </div>
  )
}
