import { CheckCircle2, FolderDown, Loader2, Server, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  defaultLocalDestinationName,
  defaultRemoteDestinationName,
  destinationNeedsJellyfinKey,
  loadDestinationSecrets,
  newDestination,
  saveDestinationSecrets,
  testDestination,
} from '../lib/download-destinations'
import { isTauriRuntime } from '../lib/api'
import type { DownloadDestination, DownloadDestinationKind } from '../types'
import { AppModal } from './AppModal'

type DownloadDestinationWizardProps = {
  open: boolean
  initial?: DownloadDestination | null
  onClose: () => void
  onSave: (destination: DownloadDestination, secrets: { jellyfinApiKey: string; sshPassword: string }, makeDefault: boolean) => Promise<void>
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
}

type WizardStep = 'choose' | 'configure' | 'confirm'

export function DownloadDestinationWizard({
  open,
  initial,
  onClose,
  onSave,
  onOpenJellyfinSignIn,
}: DownloadDestinationWizardProps) {
  const isDesktop = isTauriRuntime()
  const [step, setStep] = useState<WizardStep>(initial ? 'configure' : 'choose')
  const [destination, setDestination] = useState<DownloadDestination>(() => initial ?? newDestination('remote-jellyfin', isDesktop))
  const [jellyfinApiKey, setJellyfinApiKey] = useState('')
  const [sshPassword, setSshPassword] = useState('')
  const [makeDefault, setMakeDefault] = useState(Boolean(initial?.isDefault))
  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState<boolean | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setStep(initial ? 'configure' : 'choose')
    setDestination(initial ?? newDestination(isDesktop ? 'remote-jellyfin' : 'local', isDesktop))
    setJellyfinApiKey('')
    setSshPassword('')
    setMakeDefault(Boolean(initial?.isDefault ?? true))
    setTesting(false)
    setTestOk(null)
    setTestMessage('')
    setSaving(false)
    setError('')
    if (initial) {
      void loadDestinationSecrets(initial).then((secrets) => {
        setJellyfinApiKey(secrets.jellyfinApiKey)
        setSshPassword(secrets.sshPassword)
      })
    }
  }, [initial, isDesktop, open])

  function chooseKind(kind: DownloadDestinationKind) {
    setDestination({
      ...newDestination(kind, isDesktop),
      id: destination.id,
      name: kind === 'local' ? defaultLocalDestinationName(isDesktop) : defaultRemoteDestinationName(),
    })
    setTestOk(null)
    setTestMessage('')
    setStep('configure')
  }

  async function handleTest() {
    setTesting(true)
    setTestOk(null)
    setTestMessage('')
    setError('')
    try {
      const result = await testDestination(destination, { jellyfinApiKey, sshPassword }, isDesktop)
      setTestOk(result.ok)
      setTestMessage(result.message)
      if (!result.ok) setError(result.message)
    } catch (err) {
      setTestOk(false)
      const message = err instanceof Error ? err.message : 'Connection test failed.'
      setTestMessage(message)
      setError(message)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const result = await testDestination(destination, { jellyfinApiKey, sshPassword }, isDesktop)
      setTestOk(result.ok)
      setTestMessage(result.message)
      if (!result.ok) {
        setError(result.message)
        return
      }
      const next = {
        ...destination,
        isDefault: makeDefault,
        lastTestedAt: new Date().toISOString(),
        lastTestOk: true,
        lastTestMessage: result.message,
      }
      await onSave(next, { jellyfinApiKey, sshPassword }, makeDefault)
      await saveDestinationSecrets(next.id, { jellyfinApiKey, sshPassword })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save destination.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      open={open}
      title={initial ? 'Edit Destination' : 'Add Download Destination'}
      icon={<FolderDown size={15} />}
      onClose={onClose}
      className="preferences-modal-panel max-h-[85vh] w-full max-w-xl"
      bodyClassName="modal-scroll space-y-4 p-5"
      zClassName="z-[60]"
    >
      {step === 'choose' ? (
        <div className="space-y-4">
          <p className="text-[12px] leading-5 text-[var(--mac-secondary)]">
            Choose where completed downloads should be saved. Remote Jellyfin is best when Torfin runs on your Mac or PC and files should land on your home server.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseKind('local')}
              className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-4 text-left transition hover:border-[var(--mac-accent)] hover:bg-[var(--mac-control)]"
            >
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                <FolderDown size={16} />
                {isDesktop ? 'This device' : 'This server'}
              </div>
              <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
                {isDesktop
                  ? 'Save to a folder on this Mac. Optional Jellyfin refresh if that folder is in your library.'
                  : 'Save into the folder Torfin is configured to use on this machine (Docker or local server).'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => chooseKind('remote-jellyfin')}
              disabled={!isDesktop}
              className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-4 text-left transition hover:border-[var(--mac-accent)] hover:bg-[var(--mac-control)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                <Server size={16} />
                Remote Jellyfin
              </div>
              <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
                {isDesktop
                  ? 'SSH into your Jellyfin host and download directly into the library folder. No Torfin install needed on the server.'
                  : 'Use the desktop app to download over SSH to a remote Jellyfin server.'}
              </p>
            </button>
          </div>
        </div>
      ) : null}

      {step === 'configure' ? (
        <div className="space-y-3">
          <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
            <span>Name</span>
            <input
              value={destination.name}
              onChange={(event) => setDestination((current) => ({ ...current, name: event.target.value }))}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
            />
          </label>

          {destinationNeedsJellyfinKey(destination) ? (
            <div className="space-y-2 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
              <div className="text-[12px] font-semibold">Jellyfin</div>
              <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
                Used to refresh your library after a download finishes. The API key does not transfer files — SSH handles that below.
              </p>
              <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                <span>Server URL</span>
                <input
                  value={destination.jellyfinUrl}
                  onChange={(event) => setDestination((current) => ({ ...current, jellyfinUrl: event.target.value }))}
                  placeholder="http://jellyfin.local:8096"
                  className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
                />
              </label>
              <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                <span>API Key</span>
                <input
                  value={jellyfinApiKey}
                  onChange={(event) => setJellyfinApiKey(event.target.value)}
                  type="password"
                  placeholder="From Dashboard → API Keys"
                  className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpenJellyfinSignIn(destination.jellyfinUrl, setJellyfinApiKey)}
                  className="h-7 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[11px] font-semibold"
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : null}

          {destination.kind === 'remote-jellyfin' ? (
            <div className="space-y-2 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
              <div className="text-[12px] font-semibold">SSH to Jellyfin host</div>
              <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
                Torfin runs wget on your server over SSH. Use the same machine Jellyfin runs on, or any host that can write to the library folder.
              </p>
              <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                <span>Host</span>
                <input
                  value={destination.sshHost}
                  onChange={(event) => setDestination((current) => ({ ...current, sshHost: event.target.value }))}
                  placeholder="jellyfin.local or 192.168.1.10"
                  className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
                />
              </label>
              <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                <span>Port</span>
                <input
                  type="number"
                  value={destination.sshPort || 22}
                  onChange={(event) => setDestination((current) => ({ ...current, sshPort: Number(event.target.value) || 22 }))}
                  className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
                />
              </label>
              <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                <span>Username</span>
                <input
                  value={destination.sshUsername}
                  onChange={(event) => setDestination((current) => ({ ...current, sshUsername: event.target.value }))}
                  className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
                />
              </label>
              <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                <span>Password</span>
                <input
                  value={sshPassword}
                  onChange={(event) => setSshPassword(event.target.value)}
                  type="password"
                  placeholder="Optional if SSH key auth works"
                  className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
                />
              </label>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
            <div className="text-[12px] font-semibold">Library folders</div>
            <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
              <span>Movies</span>
              <input
                value={destination.moviesPath}
                onChange={(event) => setDestination((current) => ({ ...current, moviesPath: event.target.value }))}
                placeholder={destination.kind === 'local' ? '~/Movies/Torfin' : '/srv/media/movies'}
                className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
              />
            </label>
            <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
              <span>TV shows</span>
              <input
                value={destination.tvPath}
                onChange={(event) => setDestination((current) => ({ ...current, tvPath: event.target.value }))}
                placeholder="Optional separate TV root"
                className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
              />
            </label>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[13px]">
            <span>Refresh Jellyfin when download completes</span>
            <input
              type="checkbox"
              checked={destination.refreshOnComplete}
              onChange={(event) => setDestination((current) => ({ ...current, refreshOnComplete: event.target.checked }))}
              className="size-4 accent-[var(--mac-accent)]"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {!initial ? (
              <button type="button" onClick={() => setStep('choose')} className="h-8 rounded-md px-2 text-[12px] text-[var(--mac-secondary)]">
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold"
            >
              {testing ? <Loader2 className="animate-spin" size={14} /> : null}
              Test Connection
            </button>
          </div>

          {testMessage ? (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${testOk ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'}`}>
              {testOk ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
              <span>{testMessage}</span>
            </div>
          ) : null}

          {testOk ? (
            <div className="space-y-3 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(event) => setMakeDefault(event.target.checked)}
                  className="size-4 accent-[var(--mac-accent)]"
                />
                Set as default download destination
              </label>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-8 w-full rounded-md bg-[var(--mac-accent)] text-[12px] font-semibold text-[var(--mac-accent-text)]"
              >
                {saving ? 'Saving…' : 'Save Destination'}
              </button>
            </div>
          ) : null}

          {error && !testMessage ? <p className="text-[11px] text-red-600 dark:text-red-300">{error}</p> : null}
        </div>
      ) : null}
    </AppModal>
  )
}
