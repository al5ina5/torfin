import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'

export type AppDrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  sheetClassName?: string
  bodyClassName?: string
  subheader?: ReactNode
  zClassName?: string
  surfaceClassName?: string
  ariaLabel?: string
  titleId?: string
  role?: 'dialog' | 'alertdialog'
}

export function AppDrawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  sheetClassName = '',
  bodyClassName = '',
  subheader,
  zClassName = 'z-50',
  surfaceClassName = 'mac-elevated',
  ariaLabel,
  titleId = 'app-drawer-title',
  role = 'dialog',
}: AppDrawerProps) {
  const { mounted, visible } = useAnimatedPresence(open)
  const swipeDismiss = useSwipeDismiss(onClose, 'down')

  if (!mounted) return null

  return (
    <div className={`fixed inset-0 lg:hidden ${zClassName}`}>
      <div
        className={`app-drawer-backdrop ${visible ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        className={`app-drawer-sheet ${surfaceClassName} ${visible ? 'is-open' : ''} ${sheetClassName}`.trim()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-drawer-grabber" aria-hidden="true" {...swipeDismiss} />
        <header className="app-drawer-header" {...swipeDismiss}>
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-10 text-center">
            <div className="flex max-w-full items-center justify-center gap-1.5">
              {icon ? <span className="shrink-0 text-[var(--mac-secondary)]">{icon}</span> : null}
              <h2 id={titleId} className="truncate text-[15px] font-semibold">
                {title}
              </h2>
            </div>
            {subtitle ? (
              <p className="mt-0.5 max-w-full truncate text-[11px] text-[var(--mac-secondary)]">{subtitle}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="app-drawer-close" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {subheader ? <div className="app-drawer-subheader shrink-0">{subheader}</div> : null}
        <div className={`app-drawer-body min-h-0 ${bodyClassName}`.trim()}>
          {children}
          <div className="app-home-indicator-spacer" aria-hidden="true" />
        </div>
      </section>
    </div>
  )
}
