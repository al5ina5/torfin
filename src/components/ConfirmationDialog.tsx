import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'

type ConfirmationDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmTone?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmTone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { mounted, visible } = useAnimatedPresence(open)
  const swipeDismiss = useSwipeDismiss(onCancel, 'down')

  const confirmClassName =
    confirmTone === 'primary'
      ? 'h-8 rounded-md bg-[var(--mac-accent)] px-3 text-[12px] font-semibold text-[var(--mac-accent-text)] transition hover:brightness-95'
      : 'h-8 rounded-md bg-red-500 px-3 text-[12px] font-semibold text-white transition hover:bg-red-600'

  const mobileConfirmClassName =
    confirmTone === 'primary'
      ? 'app-confirm-sheet-action text-[var(--mac-accent)]'
      : 'app-confirm-sheet-action app-confirm-sheet-action-danger'

  if (!isDesktop) {
    if (!mounted) return null

    return (
      <div className="fixed inset-0 z-[70] lg:hidden">
        <div
          className={`app-drawer-backdrop ${visible ? 'is-open' : ''}`}
          onClick={onCancel}
          aria-hidden="true"
        />
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          className={`app-confirm-sheet ${visible ? 'is-open' : ''}`}
          onClick={(event) => event.stopPropagation()}
          {...swipeDismiss}
        >
          <div className="app-drawer-grabber" aria-hidden="true" />
          <div className="app-confirm-sheet-content mac-elevated">
            <h2 id="confirm-dialog-title" className="text-center text-[15px] font-semibold">
              {title}
            </h2>
            <p id="confirm-dialog-message" className="mt-1.5 text-center text-[13px] leading-5 text-[var(--mac-secondary)]">
              {message}
            </p>
          </div>
          <div className="app-confirm-sheet-actions mac-elevated">
            <button type="button" onClick={onConfirm} className={mobileConfirmClassName}>
              {confirmLabel}
            </button>
          </div>
          <div className="app-confirm-sheet-actions mac-elevated">
            <button type="button" onClick={onCancel} className="app-confirm-sheet-action">
              Cancel
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/25 p-4 backdrop-blur-sm" onClick={onCancel}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="mac-elevated w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--mac-border)] px-4 py-3">
          <h2 id="confirm-dialog-title" className="text-[14px] font-semibold">
            {title}
          </h2>
        </div>
        <div className="space-y-4 p-4">
          <p id="confirm-dialog-message" className="text-[12px] leading-5 text-[var(--mac-secondary)]">
            {message}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
            >
              Cancel
            </button>
            <button type="button" onClick={onConfirm} className={confirmClassName}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
