import { KeyRound, Magnet } from 'lucide-react'

import { DEBRID_SERVICE_HINT, THIRD_PARTY_STREAM_SOURCES_HINT } from '../lib/legal-notice'
import type { AppPreferences, DownloadConfig, PluginConfig } from '../types'
import { JellyfinIntegrationSettings } from './JellyfinIntegrationSettings'
import { SettingsHint } from './SettingsSection'
import { SecretInput } from './SecretInput'
import { TorboxAccountPanel } from './TorboxAccountPanel'

type IntegrationsSettingsProps = {
  plugins: PluginConfig[]
  torboxApiKey: string
  jellyfinApiKey: string
  downloadConfig: DownloadConfig
  preferences: AppPreferences
  onUpdatePlugin: (pluginId: string, patch: Partial<PluginConfig>) => void
  onChangeTorboxApiKey: (value: string) => void
  onChangeJellyfinApiKey: (value: string) => void
  onPatchDownloadConfig: (patch: Partial<DownloadConfig>) => void
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
  onPluginEnabledChange: (plugin: PluginConfig, enabled: boolean) => void
  onImportJellyfinWatchlist?: () => void
}

export function IntegrationsSettings({
  plugins,
  torboxApiKey,
  jellyfinApiKey,
  downloadConfig,
  preferences,
  onUpdatePlugin,
  onChangeTorboxApiKey,
  onChangeJellyfinApiKey,
  onPatchDownloadConfig,
  onUpdatePreferences,
  onOpenJellyfinSignIn,
  onPluginEnabledChange,
  onImportJellyfinWatchlist,
}: IntegrationsSettingsProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SettingsHint>
        Optional third-party services you connect to Torfin. Torfin does not host content — you are responsible for complying with each service&apos;s terms.
      </SettingsHint>

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
        <TorboxAccountPanel apiKey={torboxApiKey} />
        <label className="mt-3 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--mac-secondary)]">
            <KeyRound size={13} />
            API Key
          </span>
          <SecretInput value={torboxApiKey} onChange={onChangeTorboxApiKey} />
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--mac-secondary)]">Stream sources</div>
          <p className="mt-1 text-[11px] leading-4 text-[var(--mac-secondary)]">{THIRD_PARTY_STREAM_SOURCES_HINT}</p>
        </div>
        {plugins.map((plugin) => (
          <div key={plugin.id} className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--mac-control)] text-[var(--mac-secondary)]">
                <Magnet size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold">{plugin.name}</div>
                  <label className="flex items-center gap-2 text-[12px] font-medium">
                    <input
                      checked={plugin.enabled}
                      onChange={(event) => onPluginEnabledChange(plugin, event.target.checked)}
                      type="checkbox"
                      className="size-4 accent-[var(--mac-accent)]"
                    />
                    {plugin.enabled ? 'On' : 'Off'}
                  </label>
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-[var(--mac-secondary)]">
                  Third-party stream addon. Enable only if you are authorized to use this source.
                </p>
              </div>
            </div>
            <details className="group">
              <summary className="cursor-pointer text-[11px] font-semibold text-[var(--mac-secondary)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show advanced URL template</span>
                <span className="hidden group-open:inline">Hide advanced URL template</span>
              </summary>
              <textarea
                value={plugin.streamUrlTemplate}
                onChange={(event) => onUpdatePlugin(plugin.id, { streamUrlTemplate: event.target.value })}
                rows={2}
                spellCheck={false}
                className="mt-2 w-full resize-none rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 py-1.5 font-mono text-[11px] leading-4 outline-none focus:border-[var(--mac-accent)]"
              />
            </details>
          </div>
        ))}
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
