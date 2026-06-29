import { CheckCircle2, FolderDown, Loader2, Pencil, Plus, Server, Star, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'

import {
  destinationIsReady,
  destinationKindLabel,
  destinationSummary,
  loadDestinationSecrets,
  removeDestination,
  setDefaultDestination,
  testDestination,
  upsertDestination,
} from '../lib/download-destinations'
import { isTauriRuntime } from '../lib/api'
import type { DownloadConfig, DownloadDestination } from '../types'
import { DownloadDestinationWizard } from './DownloadDestinationWizard'

type DownloadDestinationsSettingsProps = {
  downloadConfig: DownloadConfig
  onUpdateDownloadConfig: (config: DownloadConfig) => void
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
}

export function DownloadDestinationsSettings({
  downloadConfig,
  onUpdateDownloadConfig,
  onOpenJellyfinSignIn,
}: DownloadDestinationsSettingsProps) {
  const isDesktop = isTauriRuntime()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<DownloadDestination | null>(null)
  const [testingId, setTestingId] = useState('')
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})

  async function handleTest(destination: DownloadDestination) {
    setTestingId(destination.id)
    try {
      const secrets = await loadDestinationSecrets(destination)
      const result = await testDestination(destination, secrets, isDesktop)
      setTestResults((current) => ({ ...current, [destination.id]: result }))
      onUpdateDownloadConfig(
        upsertDestination(downloadConfig, {
          ...destination,
          lastTestedAt: new Date().toISOString(),
          lastTestOk: result.ok,
          lastTestMessage: result.message,
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed.'
      setTestResults((current) => ({ ...current, [destination.id]: { ok: false, message } }))
    } finally {
      setTestingId('')
    }
  }

  async function handleSave(
    destination: DownloadDestination,
    secrets: { jellyfinApiKey: string; sshPassword: string },
    makeDefault: boolean,
  ) {
    onUpdateDownloadConfig(upsertDestination(downloadConfig, destination, makeDefault))
    setTestResults((current) => ({
      ...current,
      [destination.id]: { ok: true, message: destination.lastTestMessage || 'Saved.' },
    }))
    void secrets
  }

  function handleRemove(id: string) {
    if (!window.confirm('Remove this download destination?')) return
    onUpdateDownloadConfig(removeDestination(downloadConfig, id))
    setTestResults((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">Download Destinations</div>
          <p className="mt-1 text-[11px] leading-4 text-[var(--mac-secondary)]">
            Save files locally or send them straight to your Jellyfin server. Test each destination before downloading.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setWizardOpen(true)
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-[var(--mac-accent)] px-3 text-[12px] font-semibold text-[var(--mac-accent-text)]"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {!downloadConfig.destinations.length ? (
        <div className="rounded-xl border border-dashed border-[var(--mac-border)] bg-[var(--mac-surface)] p-6 text-center">
          <FolderDown className="mx-auto mb-2 text-[var(--mac-tertiary)]" size={24} />
          <p className="text-[12px] font-medium">No download destination yet</p>
          <p className="mt-1 text-[11px] text-[var(--mac-secondary)]">Add one to start downloading into Jellyfin or a local folder.</p>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="mt-4 h-8 rounded-md bg-[var(--mac-accent)] px-4 text-[12px] font-semibold text-[var(--mac-accent-text)]"
          >
            Set Up Downloads
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {downloadConfig.destinations.map((destination) => {
            const ready = destinationIsReady(destination, isDesktop)
            const test = testResults[destination.id]
            const Icon = destination.kind === 'local' ? FolderDown : Server
            return (
              <div key={destination.id} className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--mac-control)] text-[var(--mac-secondary)]">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{destination.name}</span>
                      {destination.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mac-accent)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--mac-accent)]">
                          <Star size={10} />
                          Default
                        </span>
                      ) : null}
                      <span className="text-[10px] uppercase tracking-wide text-[var(--mac-tertiary)]">
                        {destinationKindLabel(destination, isDesktop)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--mac-secondary)]">{destinationSummary(destination)}</p>
                    {destination.lastTestedAt ? (
                      <p className={`mt-1 text-[10px] ${destination.lastTestOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {destination.lastTestOk ? 'Verified' : 'Needs attention'} · {new Date(destination.lastTestedAt).toLocaleString()}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-amber-600">{ready ? 'Not tested yet' : 'Incomplete setup'}</p>
                    )}
                    {test ? (
                      <div className={`mt-2 flex items-start gap-1.5 text-[11px] ${test.ok ? 'text-emerald-600' : 'text-red-600 dark:text-red-300'}`}>
                        {test.ok ? <CheckCircle2 size={12} className="mt-0.5" /> : <XCircle size={12} className="mt-0.5" />}
                        <span>{test.message}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!destination.isDefault ? (
                      <button
                        type="button"
                        onClick={() => onUpdateDownloadConfig(setDefaultDestination(downloadConfig, destination.id))}
                        className="h-7 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[10px] font-semibold"
                      >
                        Make Default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleTest(destination)}
                      disabled={testingId === destination.id}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[10px] font-semibold"
                    >
                      {testingId === destination.id ? <Loader2 className="animate-spin" size={12} /> : null}
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(destination)
                        setWizardOpen(true)
                      }}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[10px] font-semibold"
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                    {downloadConfig.destinations.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(destination.id)}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[10px] font-semibold text-red-600"
                      >
                        <Trash2 size={11} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DownloadDestinationWizard
        open={wizardOpen}
        initial={editing}
        onClose={() => {
          setWizardOpen(false)
          setEditing(null)
        }}
        onSave={handleSave}
        onOpenJellyfinSignIn={onOpenJellyfinSignIn}
      />
    </div>
  )
}
