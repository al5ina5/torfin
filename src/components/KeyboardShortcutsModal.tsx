import { Keyboard } from 'lucide-react'

import { AppModal } from './AppModal'

const shortcuts = [
  { keys: ['⌘', 'K'], label: 'Focus search' },
  { keys: ['⌘', 'F'], label: 'Focus search' },
  { keys: ['⌘', ','], label: 'Open settings' },
  { keys: ['Enter'], label: 'Play top stream result' },
  { keys: ['Esc'], label: 'Close modal or inspector' },
  { keys: ['←', '→', '↑', '↓'], label: 'Navigate catalog' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
]

type KeyboardShortcutsModalProps = {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <AppModal
      open={open}
      title="Keyboard Shortcuts"
      icon={<Keyboard size={15} />}
      onClose={onClose}
      className="preferences-modal-panel max-w-md"
      zClassName="z-50"
    >
      <div className="space-y-1">
        {shortcuts.map((entry) => (
          <div
            key={entry.label}
            className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-[12px]"
          >
            <span className="text-[var(--mac-secondary)]">{entry.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {entry.keys.map((key) => (
                <kbd
                  key={`${entry.label}-${key}`}
                  className="rounded border border-[var(--mac-border)] bg-[var(--mac-control)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--mac-text)]"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </AppModal>
  )
}
