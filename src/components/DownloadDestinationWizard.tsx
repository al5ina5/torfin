import { FolderDown, Loader2, Server } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  defaultLocalDestinationName,
  defaultRemoteDestinationName,
  loadDestinationSecrets,
  newDestination,
  saveDestinationSecrets,
  testDestination,
} from '../lib/download-destinations'
import type { DestinationSecrets } from '../lib/download-destinations'
import { isTauriRuntime } from '../lib/api'
import { toast } from '../lib/toast'
import type { DownloadDestination, DownloadDestinationKind } from '../types'
import { AppModal } from './AppModal'

type DownloadDestinationWizardProps = {
  open: boolean
  initial?: DownloadDestination | null
  onClose: () => void
  onSave: (destination: DownloadDestination, secrets: DestinationSecrets, makeDefault: boolean) => Promise<void>
}

type WizardStep = 'choose' | 'configure'

export function DownloadDestinationWizard({
  open,
  initial,
  onClose,
  onSave,
}: DownloadDestinationWizardProps) {
  const isDesktop = isTauriRuntime()
  const [step, setStep] = useState<WizardStep>(initial ? 'configure' : 'choose')
  const [destination, setDestination] = useState<DownloadDestination>(() => initial ?? newDestination(isDesktop ? 'remote' : 'local', isDesktop))
  const [sshPassword, setSshPassword] = useState('')
  const [makeDefault, setMakeDefault] = useState(Boolean(initial?.isDefault))
  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(initial ? 'configure' : 'choose')
    setDestination(initial ?? newDestination(isDesktop ? 'remote' : 'local', isDesktop))
    setSshPassword('')
    setMakeDefault(Boolean(initial?.isDefault ?? true))
    setTesting(false)
    setTestOk(null)
    setSaving(false)
    if (initial) {
      void loadDestinationSecrets(initial).then((secrets) => {
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
    setStep('configure')
  }

  async function handleTest() {
    setTesting(true)
    setTestOk(null)
    try {
      const result = await testDestination(destination, { sshPassword }, isDesktop)
      setTestOk(result.ok)
      if (result.ok) toast.success('Connection verified', destination.name)
      else toast.error('Connection test failed', result.message)
    } catch (err) {
      setTestOk(false)
      const message = err instanceof Error ? err.message : 'Connection test failed.'
      toast.error('Connection test failed', message)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await testDestination(destination, { sshPassword }, isDesktop)
      setTestOk(result.ok)
      if (!result.ok) {
        toast.error('Could not save destination', result.message)
        return
      }
      const next = {
        ...destination,
        isDefault: makeDefault,
        lastTestedAt: new Date().toISOString(),
        lastTestOk: true,
        lastTestMessage: result.message,
      }
      await onSave(next, { sshPassword }, makeDefault)
      await saveDestinationSecrets(next.id, { sshPassword })
      onClose()
    } catch (err) {
      toast.error('Could not save destination', err instanceof Error ? err.message : 'Could not save destination.')
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
      bodyClassName="modal-scroll app-screen-body space-y-4"
      zClassName="z-[60]"
    >
      {step === 'choose' ? (
        <div className="space-y-4">
          <p className="text-[12px] leading-5 text-[var(--mac-secondary)]">
            Choose where completed downloads should be saved.
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
                  ? 'Save to a folder on this Mac or PC.'
                  : 'Save into the folder Torfin is configured to use on this machine.'}
              </p>
            </button>
            {isDesktop ? (
              <button
                type="button"
                onClick={() => chooseKind('remote')}
                className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-4 text-left transition hover:border-[var(--mac-accent)] hover:bg-[var(--mac-control)]"
              >
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                  <Server size={16} />
                  Remote server
                </div>
                <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
                  SSH into a home server or NAS and download straight into a folder there.
                </p>
              </button>
            ) : (
              <div
                aria-disabled="true"
                className="rounded-xl border border-dashed border-[var(--mac-border)] bg-[var(--mac-control)]/50 p-4 opacity-80"
              >
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[var(--mac-secondary)]">
                  <Server size={16} />
                  Remote server
                  <span className="rounded-full bg-[var(--mac-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Desktop app
                  </span>
                </div>
                <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
                  SSH downloads cannot run in the browser. Open the Torfin desktop app on your Mac or PC to add a remote server destination.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {step === 'configure' && destination.kind === 'remote' && !isDesktop ? (
        <div className="space-y-3 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-4">
          <div className="text-[13px] font-semibold">Remote destinations need the desktop app</div>
          <p className="text-[12px] leading-5 text-[var(--mac-secondary)]">
            SSH setup and downloads are only available in the Torfin desktop app. In the browser you can use a local folder, or switch to the desktop app to manage this remote destination.
          </p>
          <button type="button" onClick={onClose} className="h-8 rounded-md bg-[var(--mac-accent)] px-4 text-[12px] font-semibold text-[var(--mac-accent-text)]">
            Close
          </button>
        </div>
      ) : null}

      {step === 'configure' && (destination.kind !== 'remote' || isDesktop) ? (
        <div className="space-y-3">
          <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
            <span>Name</span>
            <input
              value={destination.name}
              onChange={(event) => setDestination((current) => ({ ...current, name: event.target.value }))}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
            />
          </label>

          {destination.kind === 'remote' ? (
            <div className="space-y-2 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
              <div className="text-[12px] font-semibold">SSH connection</div>
              <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
                Torfin runs wget on the remote host over SSH. Use any server that can write to your media folders.
              </p>
              <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                <span>Host</span>
                <input
                  value={destination.sshHost}
                  onChange={(event) => setDestination((current) => ({ ...current, sshHost: event.target.value }))}
                  placeholder="nas.local or 192.168.1.10"
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
            <div className="text-[12px] font-semibold">Save folders</div>
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
        </div>
      ) : null}
    </AppModal>
  )
}
