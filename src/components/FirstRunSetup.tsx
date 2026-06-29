import { Scale } from 'lucide-react'

import { AppModal } from './AppModal'
import {
  FIRST_RUN_DISCLAIMER_BULLETS,
  FIRST_RUN_INTRO,
  LEGAL_NOTICE_ACK_LABEL,
  LEGAL_NOTICE_REPO_URL,
} from '../lib/legal-notice'

type FirstRunSetupProps = {
  open: boolean
  legalAccepted: boolean
  onChangeLegalAccepted: (value: boolean) => void
  onOpenLegal: () => void
  onDismiss: () => void
}

export function FirstRunSetup({
  open,
  legalAccepted,
  onChangeLegalAccepted,
  onOpenLegal,
  onDismiss,
}: FirstRunSetupProps) {
  return (
    <AppModal
      open={open}
      title="Welcome to Torfin"
      onClose={legalAccepted ? onDismiss : () => {}}
      className="preferences-modal-panel max-w-lg"
      zClassName="z-50"
    >
      <div className="space-y-4 text-[12px] leading-5 text-[var(--mac-secondary)]">
        <p>{FIRST_RUN_INTRO}</p>

        <section
          className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-3"
          aria-labelledby="first-run-disclaimer-heading"
        >
          <div className="mb-2 flex items-center gap-2">
            <Scale size={14} className="shrink-0 text-[var(--mac-accent)]" />
            <h2
              id="first-run-disclaimer-heading"
              className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-text)]"
            >
              Before you continue
            </h2>
          </div>
          <ul className="list-disc space-y-1.5 pl-4 text-[11px] leading-4 text-[var(--mac-secondary)]">
            {FIRST_RUN_DISCLAIMER_BULLETS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-4 text-[var(--mac-tertiary)]">
            This is not legal advice.{' '}
            <button
              type="button"
              onClick={onOpenLegal}
              className="text-[var(--mac-accent)] underline"
            >
              Read the full legal notice
            </button>
            {' · '}
            <a
              href={LEGAL_NOTICE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--mac-accent)] underline"
            >
              docs/legal.md
            </a>
          </p>
        </section>

        <label className="flex items-start gap-2 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 py-2.5 text-[11px] leading-4 text-[var(--mac-text)]">
          <input
            checked={legalAccepted}
            onChange={(event) => onChangeLegalAccepted(event.target.checked)}
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-[var(--mac-accent)]"
          />
          <span>{LEGAL_NOTICE_ACK_LABEL}</span>
        </label>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onDismiss}
            disabled={!legalAccepted}
            className="h-8 rounded-md bg-[var(--mac-accent)] px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {legalAccepted ? 'Continue' : 'Accept to continue'}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
