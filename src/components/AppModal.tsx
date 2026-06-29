import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'

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
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { mounted, visible } = useAnimatedPresence(open)
  const swipeDismiss = useSwipeDismiss(onClose, 'down')

  if (!isDesktop) {
    if (!mounted) return null

    return (
      <div className={`fixed inset-0 lg:hidden ${zClassName}`}>
        <div
          className={`app-modal-drawer-backdrop ${visible ? 'is-open' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-modal-title"
          className={`app-modal-drawer-sheet mac-elevated ${visible ? 'is-open' : ''} ${className} !w-full !max-w-none`}
          onClick={(event) => event.stopPropagation()}
          {...swipeDismiss}
        >
          <div className="app-modal-drawer-grabber" aria-hidden="true" />
          <header className="app-modal-drawer-header">
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-10">
              {icon ? <span className="shrink-0 text-[var(--mac-secondary)]">{icon}</span> : null}
              <h2 id="app-modal-title" className="truncate text-[15px] font-semibold">
                {title}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="app-modal-drawer-close" aria-label="Close">
              <X size={18} />
            </button>
          </header>
          {headerEnd ? <div className="app-modal-drawer-subheader shrink-0">{headerEnd}</div> : null}
          <div className={`app-modal-drawer-body ${bodyClassName}`}>{children}</div>
        </section>
      </div>
    )
  }

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
