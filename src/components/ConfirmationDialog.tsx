type ConfirmationDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/25 p-4 backdrop-blur-sm" onClick={onCancel}>
      <section
        className="mac-elevated w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--mac-border)] px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-[12px] leading-5 text-[var(--mac-secondary)]">{message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="h-8 rounded-md bg-red-500 px-3 text-[12px] font-semibold text-white transition hover:bg-red-600"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
