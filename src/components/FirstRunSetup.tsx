import { AppModal } from './AppModal'

type FirstRunSetupProps = {
  open: boolean
  torboxApiKey: string
  onChangeTorboxApiKey: (value: string) => void
  onOpenSettings: () => void
  onDismiss: () => void
}

export function FirstRunSetup({
  open,
  torboxApiKey,
  onChangeTorboxApiKey,
  onOpenSettings,
  onDismiss,
}: FirstRunSetupProps) {
  const needsTorbox = !torboxApiKey.trim()

  return (
    <AppModal
      open={open}
      title="Welcome to Torfin"
      onClose={onDismiss}
      className="preferences-modal-panel max-w-lg"
      zClassName="z-50"
    >
      <div className="space-y-4 text-[12px] leading-5 text-[var(--mac-secondary)]">
        <p>Paste your Torbox API key to resolve streams. Then open Settings to enable plugins and pick a download destination for Jellyfin.</p>

        <div className="space-y-2">
          <label htmlFor="first-run-torbox" className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">
            Torbox API key
          </label>
          <input
            id="first-run-torbox"
            value={torboxApiKey}
            onChange={(event) => onChangeTorboxApiKey(event.target.value)}
            type="password"
            placeholder="Paste your Torbox API key"
            className="h-8 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[12px] outline-none focus:border-[var(--mac-accent)]"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
          >
            Open settings
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={needsTorbox}
            className="h-8 rounded-md bg-[var(--mac-accent)] px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {needsTorbox ? 'Add Torbox key to continue' : 'Get started'}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
