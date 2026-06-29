import { KeyRound, Plus, Trash2 } from 'lucide-react'

import { defaultCustomProfile } from '../lib/custom-profiles'
import type { AppPreferences, CustomStreamProfile, DownloadConfig, PluginConfig, ThemeMode } from '../types'
import type { PreferencesTab } from '../types'
import type { ResultProfile } from '../types'
import { AppModal } from './AppModal'
import { DownloadDestinationsSettings } from './DownloadDestinationsSettings'
import { TorboxAccountPanel } from './TorboxAccountPanel'

type PreferencesModalProps = {
  open: boolean
  tab: PreferencesTab
  plugins: PluginConfig[]
  resultProfiles: Array<{ id: ResultProfile; label: string }>
  preferences: AppPreferences
  downloadConfig: DownloadConfig
  torboxApiKey: string
  onClose: () => void
  onTabChange: (tab: PreferencesTab) => void
  onUpdatePlugin: (pluginId: string, patch: Partial<PluginConfig>) => void
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void
  onUpdateDownloadConfig: (config: DownloadConfig) => void
  onChangeTorboxApiKey: (value: string) => void
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
  onExportSettings: () => void
  onImportSettings: () => void
}

export function PreferencesModal({
  open,
  tab,
  plugins,
  resultProfiles,
  preferences,
  downloadConfig,
  torboxApiKey,
  onClose,
  onTabChange,
  onUpdatePlugin,
  onUpdatePreferences,
  onUpdateDownloadConfig,
  onChangeTorboxApiKey,
  onOpenJellyfinSignIn,
  onExportSettings,
  onImportSettings,
}: PreferencesModalProps) {
  return (
    <AppModal
      open={open}
      title="Preferences"
      onClose={onClose}
      className="preferences-modal-panel"
      bodyClassName="modal-scroll p-5"
      headerEnd={
        <div className="grid grid-cols-4 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] p-0.5">
          {(['general', 'plugins', 'downloads', 'playback'] as PreferencesTab[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => onTabChange(entry)}
              className={`h-7 min-w-24 rounded-md px-3 text-[12px] font-semibold capitalize transition ${
                tab === entry
                  ? 'bg-[var(--mac-elevated)] text-[var(--mac-text)] shadow-sm'
                  : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control-hover)]'
              }`}
            >
              {entry}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'general' ? (
        <div className="mx-auto max-w-xl space-y-4">
          <label className="grid grid-cols-[160px_1fr_48px] items-center gap-3 text-[13px]">
            <span>Poster Size</span>
            <input
              type="range"
              min="104"
              max="192"
              step="4"
              value={preferences.posterSize}
              onChange={(event) => onUpdatePreferences({ posterSize: Number(event.target.value) })}
              className="accent-[var(--mac-accent)]"
            />
            <span className="text-right text-[12px] text-[var(--mac-secondary)]">{preferences.posterSize}</span>
          </label>
          <label className="grid grid-cols-[160px_1fr] items-center gap-3 text-[13px]">
            <span>Default Profile</span>
            <select
              value={preferences.defaultProfile}
              onChange={(event) => onUpdatePreferences({ defaultProfile: event.target.value as ResultProfile })}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none"
            >
              {resultProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid grid-cols-[160px_1fr] items-center gap-3 text-[13px]">
            <span>Theme</span>
            <select
              value={preferences.theme}
              onChange={(event) => onUpdatePreferences({ theme: event.target.value as ThemeMode })}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 outline-none"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[13px]">
            <span>Show Years</span>
            <input
              type="checkbox"
              checked={preferences.showYears}
              onChange={(event) => onUpdatePreferences({ showYears: event.target.checked })}
              className="size-4 accent-[var(--mac-accent)]"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[13px]">
            <span>Show Ratings</span>
            <input
              type="checkbox"
              checked={preferences.showRatings}
              onChange={(event) => onUpdatePreferences({ showRatings: event.target.checked })}
              className="size-4 accent-[var(--mac-accent)]"
            />
          </label>

          <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12px] font-semibold">Custom Stream Profiles</div>
              <button
                type="button"
                onClick={() =>
                  onUpdatePreferences({
                    customProfiles: [...preferences.customProfiles, defaultCustomProfile()],
                  })
                }
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[11px] font-semibold"
              >
                <Plus size={12} />
                Add
              </button>
            </div>
            <div className="space-y-3">
              {preferences.customProfiles.map((profile) => (
                <CustomProfileEditor
                  key={profile.id}
                  profile={profile}
                  onChange={(next) =>
                    onUpdatePreferences({
                      customProfiles: preferences.customProfiles.map((entry) => (entry.id === profile.id ? next : entry)),
                    })
                  }
                  onRemove={() =>
                    onUpdatePreferences({
                      customProfiles: preferences.customProfiles.filter((entry) => entry.id !== profile.id),
                    })
                  }
                />
              ))}
              {!preferences.customProfiles.length ? (
                <p className="text-[11px] text-[var(--mac-secondary)]">Create profiles with your own resolution and size rules.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
            <div className="mb-2 text-[12px] font-semibold">Settings Backup</div>
            <p className="mb-3 text-[11px] leading-4 text-[var(--mac-secondary)]">
              Export preferences, plugins, layout, and filter presets. API keys are not included.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExportSettings}
                className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
              >
                Export
              </button>
              <button
                type="button"
                onClick={onImportSettings}
                className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'plugins' ? (
        <div className="mx-auto max-w-2xl space-y-4">
          <TorboxAccountPanel apiKey={torboxApiKey} />
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--mac-secondary)]">
              <KeyRound size={13} />
              Torbox API Key
            </span>
            <input
              value={torboxApiKey}
              onChange={(event) => onChangeTorboxApiKey(event.target.value)}
              type="password"
              className="h-8 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[12px] outline-none focus:border-[var(--mac-accent)]"
            />
          </label>
          <div className="space-y-3">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[13px] font-semibold">
                    <input
                      checked={plugin.enabled}
                      onChange={(event) => onUpdatePlugin(plugin.id, { enabled: event.target.checked })}
                      type="checkbox"
                      className="size-4 accent-[var(--mac-accent)]"
                    />
                    {plugin.name}
                  </label>
                  {plugin.enabled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--mac-accent)]">On</span>
                  ) : null}
                </div>
                <textarea
                  value={plugin.streamUrlTemplate}
                  onChange={(event) => onUpdatePlugin(plugin.id, { streamUrlTemplate: event.target.value })}
                  rows={2}
                  spellCheck={false}
                  className="w-full resize-none rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 py-1.5 font-mono text-[11px] leading-4 outline-none focus:border-[var(--mac-accent)]"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'downloads' ? (
        <DownloadDestinationsSettings
          downloadConfig={downloadConfig}
          onUpdateDownloadConfig={onUpdateDownloadConfig}
          onOpenJellyfinSignIn={onOpenJellyfinSignIn}
        />
      ) : null}

      {tab === 'playback' ? (
        <div className="mx-auto max-w-xl space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[13px]">
            <span>Auto play resolved streams</span>
            <input
              type="checkbox"
              checked={preferences.autoPlayResolvedStreams}
              onChange={(event) => onUpdatePreferences({ autoPlayResolvedStreams: event.target.checked })}
              className="size-4 accent-[var(--mac-accent)]"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[13px]">
            <span>Prefer cached results</span>
            <input
              type="checkbox"
              checked={preferences.preferCachedResults}
              onChange={(event) => onUpdatePreferences({ preferCachedResults: event.target.checked })}
              className="size-4 accent-[var(--mac-accent)]"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[13px]">
            <span>Auto-play next episode</span>
            <input
              type="checkbox"
              checked={preferences.autoPlayNextEpisode}
              onChange={(event) => onUpdatePreferences({ autoPlayNextEpisode: event.target.checked })}
              className="size-4 accent-[var(--mac-accent)]"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[13px]">
            <span>Download completion notifications</span>
            <input
              type="checkbox"
              checked={preferences.downloadNotifications}
              onChange={(event) => onUpdatePreferences({ downloadNotifications: event.target.checked })}
              className="size-4 accent-[var(--mac-accent)]"
            />
          </label>
          <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">
            macOS will ask for notification permission once. No Apple Developer certificate is required for local download alerts.
          </p>
        </div>
      ) : null}
    </AppModal>
  )
}

function CustomProfileEditor({
  profile,
  onChange,
  onRemove,
}: {
  profile: CustomStreamProfile
  onChange: (profile: CustomStreamProfile) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={profile.label}
          onChange={(event) => onChange({ ...profile, label: event.target.value })}
          className="h-7 flex-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2 text-[12px] outline-none"
        />
        <button type="button" onClick={onRemove} className="grid size-7 place-items-center rounded-md border border-[var(--mac-border)]">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <label>
          Max resolution
          <select
            value={profile.maxResolution}
            onChange={(event) => onChange({ ...profile, maxResolution: Number(event.target.value) as CustomStreamProfile['maxResolution'] })}
            className="mt-1 h-7 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2"
          >
            <option value={0}>Any</option>
            <option value={480}>480p</option>
            <option value={720}>720p</option>
            <option value={1080}>1080p</option>
            <option value={2160}>4K</option>
          </select>
        </label>
        <label>
          Max size (GB)
          <input
            type="number"
            min={0}
            value={profile.maxFileSizeGb || ''}
            onChange={(event) => onChange({ ...profile, maxFileSizeGb: Number(event.target.value) || 0 })}
            placeholder="0 = unlimited"
            className="mt-1 h-7 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2"
          />
        </label>
        <label>
          Max results
          <input
            type="number"
            min={1}
            max={20}
            value={profile.maxResults}
            onChange={(event) => onChange({ ...profile, maxResults: Number(event.target.value) || 6 })}
            className="mt-1 h-7 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2"
          />
        </label>
        <label className="flex items-end gap-2 pb-1">
          <input
            type="checkbox"
            checked={profile.onePerResolution}
            onChange={(event) => onChange({ ...profile, onePerResolution: event.target.checked })}
            className="size-4 accent-[var(--mac-accent)]"
          />
          One per resolution
        </label>
      </div>
    </div>
  )
}
