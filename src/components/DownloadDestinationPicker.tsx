import { FolderDown, Loader2, Server, Star } from 'lucide-react'

import { destinationSummary } from '../lib/download-destinations'
import type { DownloadDestination } from '../types'
import { AppModal } from './AppModal'

type DownloadDestinationPickerProps = {
  open: boolean
  title: string
  subtitle?: string
  destinations: DownloadDestination[]
  loading?: boolean
  onClose: () => void
  onSelect: (destination: DownloadDestination) => void
  onSetup: () => void
  onManage: () => void
}

export function DownloadDestinationPicker({
  open,
  title,
  subtitle,
  destinations,
  loading = false,
  onClose,
  onSelect,
  onSetup,
  onManage,
}: DownloadDestinationPickerProps) {
  return (
    <AppModal
      open={open}
      title="Download to…"
      icon={<FolderDown size={15} />}
      onClose={onClose}
      className="max-h-[80vh] w-full max-w-md"
      bodyClassName="space-y-3 p-4"
      zClassName="z-[55]"
    >
      <div>
        <div className="text-[13px] font-semibold">{title}</div>
        {subtitle ? <p className="mt-1 text-[11px] text-[var(--mac-secondary)]">{subtitle}</p> : null}
      </div>

      {!destinations.length ? (
        <div className="rounded-lg border border-dashed border-[var(--mac-border)] bg-[var(--mac-surface)] p-4 text-center">
          <p className="text-[12px] font-medium">Set up a download destination first</p>
          <p className="mt-1 text-[11px] text-[var(--mac-secondary)]">
            Connect your Jellyfin server or choose a local folder, then come back to download.
          </p>
          <button
            type="button"
            onClick={onSetup}
            className="mt-3 h-8 rounded-md bg-[var(--mac-accent)] px-4 text-[12px] font-semibold text-[var(--mac-accent-text)]"
          >
            Set Up Destination
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {destinations.map((destination) => {
            const Icon = destination.kind === 'local' ? FolderDown : Server
            return (
              <button
                key={destination.id}
                type="button"
                disabled={loading}
                onClick={() => onSelect(destination)}
                className="flex w-full items-start gap-3 rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3 text-left transition hover:border-[var(--mac-accent)] hover:bg-[var(--mac-control)] disabled:opacity-60"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--mac-control)] text-[var(--mac-secondary)]">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Icon size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{destination.name}</span>
                    {destination.isDefault ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--mac-accent)]">
                        <Star size={10} />
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--mac-secondary)]">{destinationSummary(destination)}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <button type="button" onClick={onManage} className="h-8 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] text-[12px] font-semibold">
        Manage Destinations…
      </button>
    </AppModal>
  )
}
