import { AppModal } from './AppModal'
import { LEGAL_NOTICE_ACK_LABEL, LEGAL_NOTICE_SHORT } from '../lib/legal-notice'

type FirstRunSetupProps = {
  open: boolean
  torboxApiKey: string
  legalAccepted: boolean
  onChangeTorboxApiKey: (value: string) => void
  onChangeLegalAccepted: (value: boolean) => void
  onOpenSettings: () => void
  onDismiss: () => void
}

export function FirstRunSetup({
  open,
  torboxApiKey,
  legalAccepted,
  onChangeTorboxApiKey,
  onChangeLegalAccepted,
  onOpenSettings,
  onDismiss,
}: FirstRunSetupProps) {
  const needsTorbox = !torboxApiKey.trim()
  const canContinue = !needsTorbox && legalAccepted

  return (
    <AppModal
      open={open}
      title="Welcome to Torfin"
      onClose={onDismiss}
      className="preferences-modal-panel max-w-lg"
      zClassName="z-50"
    >
      <div className="space-y-4 text-[12px] leading-5 text-[var(--mac-secondary)]">
        <p>
          Torfin is a client for your homelab. Paste your Torbox API key to resolve streams, then open Settings →
          Accounts to connect your debrid service, enable third-party stream addons, and pick a download destination for
          Jellyfin.
        </p>

        <p className="rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[11px] leading-4 text-[var(--mac-tertiary)]">
          {LEGAL_NOTICE_SHORT}{' '}
          <a
            href="https://github.com/al5ina5/torfin/blob/main/docs/legal.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--mac-accent)] underline"
          >
            Read the legal notice
          </a>
          .
        </p>

        <label className="flex items-start gap-2 text-[11px] leading-4 text-[var(--mac-secondary)]">
          <input
            checked={legalAccepted}
            onChange={(event) => onChangeLegalAccepted(event.target.checked)}
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-[var(--mac-accent)]"
          />
          <span>{LEGAL_NOTICE_ACK_LABEL}</span>
        </label>

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
            disabled={!canContinue}
            className="h-8 rounded-md bg-[var(--mac-accent)] px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {!legalAccepted ? 'Accept notice to continue' : needsTorbox ? 'Add Torbox key to continue' : 'Get started'}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
