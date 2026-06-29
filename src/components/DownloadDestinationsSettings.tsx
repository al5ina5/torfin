import { FolderDown, Loader2, Pencil, Plus, Server, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  destinationIsConfigured,
  destinationIsReady,
  destinationKindLabel,
  destinationSummary,
  loadDestinationSecrets,
  removeDestination,
  setDefaultDestination,
  testDestination,
  upsertDestination,
} from '../lib/download-destinations'
import type { DestinationSecrets } from '../lib/download-destinations'
import { isTauriRuntime } from '../lib/api'
import { toast } from '../lib/toast'
import type { DownloadConfig, DownloadDestination } from '../types'
import { DownloadDestinationWizard } from './DownloadDestinationWizard'
import { JellyfinIntegrationSettings } from './JellyfinIntegrationSettings'

type DownloadDestinationsSettingsProps = {
  downloadConfig: DownloadConfig
  jellyfinApiKey: string
  onUpdateDownloadConfig: (config: DownloadConfig) => void
  onPatchDownloadConfig: (patch: Partial<DownloadConfig>) => void
  onChangeJellyfinApiKey: (value: string) => void
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
}

export function DownloadDestinationsSettings({
  downloadConfig,
  jellyfinApiKey,
  onUpdateDownloadConfig,
  onPatchDownloadConfig,
  onChangeJellyfinApiKey,
  onOpenJellyfinSignIn,
}: DownloadDestinationsSettingsProps) {
  const isDesktop = isTauriRuntime()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<DownloadDestination | null>(null)
  const [testingId, setTestingId] = useState('')

  async function handleTest(destination: DownloadDestination) {
    setTestingId(destination.id)
    try {
      const secrets = await loadDestinationSecrets(destination)
      const result = await testDestination(destination, secrets, isDesktop)
      if (result.ok) toast.success('Connection verified', destination.name)
      else toast.error('Connection test failed', result.message)
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
      toast.error('Connection test failed', message)
    } finally {
      setTestingId('')
    }
  }

  async function handleSave(destination: DownloadDestination, secrets: DestinationSecrets, makeDefault: boolean) {
    onUpdateDownloadConfig(upsertDestination(downloadConfig, destination, makeDefault))
    toast.success('Destination saved', destination.name)
    void secrets
  }

  function handleRemove(id: string) {
    if (!window.confirm('Remove this download destination?')) return
    const destination = downloadConfig.destinations.find((entry) => entry.id === id)
    onUpdateDownloadConfig(removeDestination(downloadConfig, id))
    toast.info('Destination removed', destination?.name)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold">Where files go</div>
            <p className="mt-1 text-[11px] leading-4 text-[var(--mac-secondary)]">
              {isDesktop
                ? 'Save locally on this device, or over SSH to a remote server. Test each destination before downloading.'
                : 'In the browser, downloads save to a folder on this server. Remote SSH destinations are available in the Torfin desktop app.'}
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

        {!isDesktop ? (
          <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 py-2.5 text-[11px] leading-4 text-[var(--mac-secondary)]">
            <span className="font-semibold text-[var(--mac-text)]">Remote server (SSH)</span>
            {' — '}
            only in the desktop app. Browsers cannot open SSH connections, so use the Torfin Mac/PC app to download to a home server or NAS.
          </div>
        ) : null}

        {!downloadConfig.destinations.length ? (
          <div className="rounded-xl border border-dashed border-[var(--mac-border)] bg-[var(--mac-surface)] p-6 text-center">
            <FolderDown className="mx-auto mb-2 text-[var(--mac-tertiary)]" size={24} />
            <p className="text-[12px] font-medium">No download destination yet</p>
            <p className="mt-1 text-[11px] text-[var(--mac-secondary)]">Add a local folder or remote SSH path to start downloading.</p>
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
              const configured = destinationIsConfigured(destination)
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
                        {destination.kind === 'remote' && !isDesktop ? (
                          <span className="rounded-full bg-[var(--mac-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--mac-secondary)]">
                            Desktop app only
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--mac-secondary)]">{destinationSummary(destination)}</p>
                      {destination.lastTestedAt ? (
                        <p className={`mt-1 text-[10px] ${destination.lastTestOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {destination.lastTestOk ? 'Verified' : 'Needs attention'} · {new Date(destination.lastTestedAt).toLocaleString()}
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] text-amber-600">
                          {ready
                            ? 'Not tested yet'
                            : destination.kind === 'remote' && !isDesktop
                              ? 'Open the desktop app to use or edit'
                              : configured
                                ? 'Not tested yet'
                                : 'Incomplete setup'}
                        </p>
                      )}
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
                        disabled={testingId === destination.id || (destination.kind === 'remote' && !isDesktop)}
                        title={destination.kind === 'remote' && !isDesktop ? 'Open the Torfin desktop app to test SSH' : undefined}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
                        disabled={destination.kind === 'remote' && !isDesktop}
                        title={destination.kind === 'remote' && !isDesktop ? 'Open the Torfin desktop app to edit remote destinations' : undefined}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
        />
      </div>

      <JellyfinIntegrationSettings
        downloadConfig={downloadConfig}
        jellyfinApiKey={jellyfinApiKey}
        onPatchDownloadConfig={onPatchDownloadConfig}
        onChangeJellyfinApiKey={onChangeJellyfinApiKey}
        onOpenJellyfinSignIn={onOpenJellyfinSignIn}
      />
    </div>
  )
}
