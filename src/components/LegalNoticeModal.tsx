import { Scale } from 'lucide-react'

import { AppModal } from './AppModal'
import { LEGAL_NOTICE_REPO_URL, LEGAL_NOTICE_SECTIONS } from '../lib/legal-notice'

type LegalNoticeModalProps = {
  open: boolean
  onClose: () => void
}

export function LegalNoticeModal({ open, onClose }: LegalNoticeModalProps) {
  return (
    <AppModal
      open={open}
      title="Legal Notice"
      icon={<Scale size={15} />}
      onClose={onClose}
      className="preferences-modal-panel max-w-lg"
      zClassName="z-50"
    >
      <div className="modal-scroll max-h-[min(70vh,560px)] space-y-4 pr-1 text-[12px] leading-5 text-[var(--mac-secondary)]">
        {LEGAL_NOTICE_SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-tertiary)]">
              {section.title}
            </h3>
            {'body' in section && section.body ? <p>{section.body}</p> : null}
            {'bullets' in section && section.bullets ? (
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <p className="border-t border-[var(--mac-border)] pt-3 text-[11px] text-[var(--mac-tertiary)]">
          Full notice:{' '}
          <a
            href={LEGAL_NOTICE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--mac-accent)] underline"
          >
            docs/legal.md
          </a>
        </p>
      </div>
    </AppModal>
  )
}
