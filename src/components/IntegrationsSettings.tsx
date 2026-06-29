import { KeyRound } from 'lucide-react'

import { CONNECTED_SERVICES_HINT, DEBRID_SERVICE_HINT } from '../lib/legal-notice'
import type { AppPreferences, DownloadConfig } from '../types'
import { JellyfinIntegrationSettings } from './JellyfinIntegrationSettings'
import { SettingsHint } from './SettingsSection'
import { SecretInput } from './SecretInput'
import { TorboxAccountPanel } from './TorboxAccountPanel'

type IntegrationsSettingsProps = {
  torboxApiKey: string
  jellyfinApiKey: string
  downloadConfig: DownloadConfig
  preferences: AppPreferences
  onChangeTorboxApiKey: (value: string) => void
  onChangeJellyfinApiKey: (value: string) => void
  onPatchDownloadConfig: (patch: Partial<DownloadConfig>) => void
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
  onImportJellyfinWatchlist?: () => void
}

export function IntegrationsSettings({
  torboxApiKey,
  jellyfinApiKey,
  downloadConfig,
  preferences,
  onChangeTorboxApiKey,
  onChangeJellyfinApiKey,
  onPatchDownloadConfig,
  onUpdatePreferences,
  onOpenJellyfinSignIn,
  onImportJellyfinWatchlist,
}: IntegrationsSettingsProps) {
  return (
    <div className="space-y-3">
      <SettingsHint>{CONNECTED_SERVICES_HINT}</SettingsHint>

      <div className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--mac-control)] text-[var(--mac-secondary)]">
            <KeyRound size={16} />
          </div>
          <div>
            <div className="text-[13px] font-semibold">Torbox</div>
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--mac-secondary)]">{DEBRID_SERVICE_HINT}</p>
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--mac-secondary)]">
            <KeyRound size={13} />
            API Key
          </span>
          <SecretInput value={torboxApiKey} onChange={onChangeTorboxApiKey} />
        </label>
        {torboxApiKey.trim() ? (
          <div className="mt-3">
            <TorboxAccountPanel apiKey={torboxApiKey} />
          </div>
        ) : null}
      </div>

      <JellyfinIntegrationSettings
        downloadConfig={downloadConfig}
        jellyfinApiKey={jellyfinApiKey}
        preferences={preferences}
        onPatchDownloadConfig={onPatchDownloadConfig}
        onChangeJellyfinApiKey={onChangeJellyfinApiKey}
        onUpdatePreferences={onUpdatePreferences}
        onOpenJellyfinSignIn={onOpenJellyfinSignIn}
        onImportJellyfinWatchlist={onImportJellyfinWatchlist}
      />
    </div>
  )
}
