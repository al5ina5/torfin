import type { ReactNode } from 'react'

import { useMediaQuery } from '../hooks/useMediaQuery'
import { AppDrawer } from './AppDrawer'

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
  bodyClassName = 'modal-scroll app-screen-body',
  headerEnd,
  zClassName = 'z-50',
}: AppModalProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (!isDesktop) {
    return (
      <AppDrawer
        open={open}
        title={title}
        icon={icon}
        onClose={onClose}
        subheader={headerEnd}
        zClassName={zClassName}
        sheetClassName={`${className} !w-full !max-w-none`}
        bodyClassName={bodyClassName}
        titleId="app-modal-title"
      >
        {children}
      </AppDrawer>
    )
  }

  if (!open) return null

  return (
    <div className={`app-modal-backdrop fixed inset-0 ${zClassName} bg-black/30 p-4 backdrop-blur-sm`} onClick={onClose}>
      <section
        data-focus-zone="modal"
        className={`mac-elevated flex flex-col overflow-hidden rounded-xl border ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mac-toolbar shrink-0 border-b border-[var(--mac-divider,var(--mac-border))]">
          <div className="app-modal-titlebar">
            <button
              type="button"
              onClick={onClose}
              className="size-3.5 shrink-0 rounded-full bg-[#ff5f57] transition hover:brightness-95"
              title="Close"
            />
            {icon ? <span className="shrink-0 text-[var(--mac-secondary)]">{icon}</span> : null}
            <div className="min-w-0 truncate text-[13px] font-semibold">{title}</div>
          </div>
          {headerEnd ? <div className="app-modal-subheader">{headerEnd}</div> : null}
        </header>
        <div className={bodyClassName}>{children}</div>
      </section>
    </div>
  )
}
