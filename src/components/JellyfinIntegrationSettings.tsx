import { Loader2, Tv } from 'lucide-react'
import { useState } from 'react'

import { testJellyfinConnection } from '../lib/download-destinations'
import { toast } from '../lib/toast'
import type { DownloadConfig } from '../types'

type JellyfinIntegrationSettingsProps = {
  downloadConfig: DownloadConfig
  jellyfinApiKey: string
  onPatchDownloadConfig: (patch: Partial<DownloadConfig>) => void
  onChangeJellyfinApiKey: (value: string) => void
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
}

export function JellyfinIntegrationSettings({
  downloadConfig,
  jellyfinApiKey,
  onPatchDownloadConfig,
  onChangeJellyfinApiKey,
  onOpenJellyfinSignIn,
}: JellyfinIntegrationSettingsProps) {
  const [testing, setTesting] = useState(false)

  async function handleTest() {
    setTesting(true)
    try {
      const result = await testJellyfinConnection(downloadConfig.jellyfinUrl, jellyfinApiKey)
      toast.success('Jellyfin connected', `${result.name} (${result.version})`)
    } catch (error) {
      toast.error('Jellyfin connection failed', error instanceof Error ? error.message : 'Connection failed.')
    } finally {
      setTesting(false)
    }
  }

  const configured = Boolean(downloadConfig.jellyfinUrl.trim() && jellyfinApiKey.trim())

  return (
    <div className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--mac-control)] text-[var(--mac-secondary)]">
          <Tv size={16} />
        </div>
        <div>
          <div className="text-[13px] font-semibold">Jellyfin</div>
          <p className="mt-0.5 text-[11px] leading-4 text-[var(--mac-secondary)]">
            Optional. Connect Jellyfin to check if titles are already in your library and refresh the library after downloads finish. This is separate from where files are saved.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
          <span>Server URL</span>
          <input
            value={downloadConfig.jellyfinUrl}
            onChange={(event) => onPatchDownloadConfig({ jellyfinUrl: event.target.value })}
            placeholder="http://jellyfin.local:8096"
            className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          />
        </label>
        <label className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
          <span>API Key</span>
          <input
            value={jellyfinApiKey}
            onChange={(event) => onChangeJellyfinApiKey(event.target.value)}
            type="password"
            placeholder="From Dashboard → API Keys"
            className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none focus:border-[var(--mac-accent)]"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenJellyfinSignIn(downloadConfig.jellyfinUrl, onChangeJellyfinApiKey)}
            className="h-7 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[11px] font-semibold"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || !downloadConfig.jellyfinUrl.trim()}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[11px] font-semibold disabled:opacity-50"
          >
            {testing ? <Loader2 className="animate-spin" size={12} /> : null}
            Test
          </button>
        </div>
      </div>

      {configured ? (
        <p className="mt-3 text-[10px] text-[var(--mac-tertiary)]">Jellyfin configured — library lookup and refresh are available.</p>
      ) : null}

      <label className="mt-3 flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 py-2 text-[13px]">
        <div>
          <span>Refresh library after download</span>
          <p className="text-[10px] text-[var(--mac-secondary)]">Scans new files into Jellyfin when a download completes.</p>
        </div>
        <input
          type="checkbox"
          checked={downloadConfig.refreshJellyfinOnComplete}
          onChange={(event) => onPatchDownloadConfig({ refreshJellyfinOnComplete: event.target.checked })}
          disabled={!configured}
          className="size-4 accent-[var(--mac-accent)] disabled:opacity-40"
        />
      </label>
    </div>
  )
}
