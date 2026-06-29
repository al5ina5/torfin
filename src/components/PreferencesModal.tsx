import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { defaultCustomProfile } from '../lib/custom-profiles'
import { isMacTauri, listNativePlayers, type NativePlayerOption } from '../lib/native-player'
import { catalogOptions, libraryCatalogOptions } from '../lib/movies'
import {
  INDEXER_SOURCES_HINT,
  THIRD_PARTY_ADDON_ENABLE_TITLE,
  thirdPartyAddonEnableMessage,
} from '../lib/legal-notice'
import { hasThirdPartyAddonAck, markThirdPartyAddonAck } from '../lib/third-party-addon-ack'
import type {
  AppPreferences,
  CustomStreamProfile,
  DownloadConfig,
  MacNativePlayer,
  NextEpisodeCountdownSeconds,
  PluginConfig,
  PreferencesTab,
  ResultProfile,
  StartupCatalogId,
  ThemeMode,
} from '../types'
import { AppModal } from './AppModal'
import { DownloadDestinationsSettings } from './DownloadDestinationsSettings'
import { IntegrationsSettings } from './IntegrationsSettings'
import { StreamIndexerSettings } from './StreamIndexerSettings'
import {
  SettingsField,
  SettingsHint,
  SettingsRange,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
} from './SettingsSection'
import { ConfirmationDialog } from './ConfirmationDialog'

type PreferencesModalProps = {
  open: boolean
  tab: PreferencesTab
  plugins: PluginConfig[]
  resultProfiles: Array<{ id: ResultProfile; label: string }>
  preferences: AppPreferences
  downloadConfig: DownloadConfig
  torboxApiKey: string
  jellyfinApiKey: string
  onClose: () => void
  onTabChange: (tab: PreferencesTab) => void
  onUpdatePlugin: (pluginId: string, patch: Partial<PluginConfig>) => void
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void
  onUpdateDownloadConfig: (config: DownloadConfig) => void
  onChangeTorboxApiKey: (value: string) => void
  onChangeJellyfinApiKey: (value: string) => void
  onOpenJellyfinSignIn: (baseUrl: string, onToken: (token: string) => void) => void
  onImportJellyfinWatchlist?: () => void
  onExportSettings: () => void
  onImportSettings: () => void
  onClearSearchHistory: () => void
  onResetPanelSizes: () => void
}

const macNativePlayerFallback: NativePlayerOption[] = [
  { id: 'auto', label: 'Automatic', available: true },
  { id: 'avplayer', label: 'AVPlayer (built-in window)', available: true },
  { id: 'quicktime', label: 'QuickTime Player', available: true },
  { id: 'mpv', label: 'mpv', available: false },
  { id: 'iina', label: 'IINA', available: false },
  { id: 'vlc', label: 'VLC', available: false },
]

const preferenceTabLabels: Record<PreferencesTab, string> = {
  general: 'General',
  playback: 'Playback',
  downloads: 'Downloads',
  integrations: 'Integrations',
  advanced: 'Advanced',
}

const preferenceTabs: PreferencesTab[] = ['general', 'playback', 'downloads', 'integrations', 'advanced']

const startupCatalogOptions: Array<{ id: StartupCatalogId; label: string }> = [
  { id: 'lastUsed', label: 'Last used' },
  ...libraryCatalogOptions.map((entry) => ({ id: entry.id as StartupCatalogId, label: entry.label })),
  ...catalogOptions.filter((entry) => ['trending', 'topRated', 'featured', 'newReleases'].includes(entry.id)).map((entry) => ({
    id: entry.id as StartupCatalogId,
    label: entry.label,
  })),
]

export function PreferencesModal({
  open,
  tab,
  plugins,
  resultProfiles,
  preferences,
  downloadConfig,
  torboxApiKey,
  jellyfinApiKey,
  onClose,
  onTabChange,
  onUpdatePlugin,
  onUpdatePreferences,
  onUpdateDownloadConfig,
  onChangeTorboxApiKey,
  onChangeJellyfinApiKey,
  onOpenJellyfinSignIn,
  onImportJellyfinWatchlist,
  onExportSettings,
  onImportSettings,
  onClearSearchHistory,
  onResetPanelSizes,
}: PreferencesModalProps) {
  const [nativePlayers, setNativePlayers] = useState<NativePlayerOption[]>([])
  const [pendingPluginEnable, setPendingPluginEnable] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!open || tab !== 'playback' || !isMacTauri()) return
    void listNativePlayers()
      .then(setNativePlayers)
      .catch(() => setNativePlayers([]))
  }, [open, tab])

  function handlePluginEnabledChange(plugin: PluginConfig, enabled: boolean) {
    if (!enabled) {
      onUpdatePlugin(plugin.id, { enabled: false })
      return
    }
    if (hasThirdPartyAddonAck(plugin.id)) {
      onUpdatePlugin(plugin.id, { enabled: true })
      return
    }
    setPendingPluginEnable({ id: plugin.id, name: plugin.name })
  }

  function confirmPendingPluginEnable() {
    if (!pendingPluginEnable) return
    markThirdPartyAddonAck(pendingPluginEnable.id)
    onUpdatePlugin(pendingPluginEnable.id, { enabled: true })
    setPendingPluginEnable(null)
  }

  return (
    <>
    <AppModal
      open={open}
      title="Preferences"
      onClose={onClose}
      className="preferences-modal-panel"
      headerEnd={
        <div className="flex w-full gap-0.5 overflow-x-auto rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] p-0.5">
          {preferenceTabs.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => onTabChange(entry)}
              aria-label={preferenceTabLabels[entry]}
              aria-current={tab === entry ? 'page' : undefined}
              className={`h-7 shrink-0 rounded-md px-2.5 text-[11px] font-semibold transition ${
                tab === entry
                  ? 'bg-[var(--mac-elevated)] text-[var(--mac-text)] shadow-sm'
                  : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control-hover)]'
              }`}
            >
              {preferenceTabLabels[entry]}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'general' ? (
        <div className="space-y-0">
          <SettingsSection title="Appearance" first>
            <SettingsRange
              label="Poster size"
              value={preferences.posterSize}
              min={104}
              max={192}
              step={4}
              onChange={(posterSize) => onUpdatePreferences({ posterSize })}
            />
            <SettingsField label="Theme">
              <SettingsSelect value={preferences.theme} onChange={(value) => onUpdatePreferences({ theme: value as ThemeMode })}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </SettingsSelect>
            </SettingsField>
            <SettingsToggle
              label="Show years"
              checked={preferences.showYears}
              onChange={(showYears) => onUpdatePreferences({ showYears })}
            />
            <SettingsToggle
              label="Show ratings"
              checked={preferences.showRatings}
              onChange={(showRatings) => onUpdatePreferences({ showRatings })}
            />
            <SettingsField label="Library view" hint="Default layout for the movie grid. You can still toggle it from the toolbar.">
              <SettingsSelect
                value={preferences.libraryViewMode}
                onChange={(value) => onUpdatePreferences({ libraryViewMode: value === 'list' ? 'list' : 'grid' })}
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </SettingsSelect>
            </SettingsField>
          </SettingsSection>

          <SettingsSection title="Startup & Library">
            <SettingsField label="Default content type" hint="Which library opens when the app starts at home.">
              <SettingsSelect
                value={preferences.defaultContentType}
                onChange={(value) => onUpdatePreferences({ defaultContentType: value === 'series' ? 'series' : 'movie' })}
              >
                <option value="movie">Movies</option>
                <option value="series">TV Shows</option>
              </SettingsSelect>
            </SettingsField>
            <SettingsField label="Startup catalog" hint="Choose a catalog for fresh app launches. Last used restores your previous browse location.">
              <SettingsSelect
                value={preferences.defaultStartupCatalog}
                onChange={(value) => onUpdatePreferences({ defaultStartupCatalog: value as StartupCatalogId })}
              >
                {startupCatalogOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
            <SettingsField label="Default stream profile" hint="Profile applied when you open a title.">
              <SettingsSelect
                value={preferences.defaultProfile}
                onChange={(value) => onUpdatePreferences({ defaultProfile: value as ResultProfile })}
              >
                {resultProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          </SettingsSection>

          <SettingsSection title="History & Search">
            <SettingsField label="Continue watching limit" hint="Maximum titles kept in Continue Watching.">
              <SettingsSelect
                value={preferences.continueWatchingLimit}
                onChange={(value) => onUpdatePreferences({ continueWatchingLimit: Number(value) })}
              >
                {[10, 20, 30, 40].map((value) => (
                  <option key={value} value={value}>
                    {value} titles
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
            <SettingsField label="Recently viewed limit" hint="How many titles appear in Recently Viewed.">
              <SettingsSelect
                value={preferences.recentViewsLimit}
                onChange={(value) => onUpdatePreferences({ recentViewsLimit: Number(value) })}
              >
                {[10, 20, 30].map((value) => (
                  <option key={value} value={value}>
                    {value} titles
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
            <SettingsToggle
              label="Search history"
              hint="Remember recent searches and show them when the search field is focused."
              checked={preferences.searchHistoryEnabled}
              onChange={(searchHistoryEnabled) => onUpdatePreferences({ searchHistoryEnabled })}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClearSearchHistory}
                className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
              >
                Clear search history
              </button>
            </div>
          </SettingsSection>
        </div>
      ) : null}

      {tab === 'playback' ? (
        <div className="space-y-0">
          {isMacTauri() ? (
            <SettingsSection title="macOS Player" first>
              <SettingsToggle
                label="Use native macOS player"
                hint="Open streams in an external or built-in macOS player instead of the in-app web player. Handles MKV, multi-audio, and subtitles without transcoding."
                checked={preferences.useNativeMacPlayer}
                onChange={(useNativeMacPlayer) => onUpdatePreferences({ useNativeMacPlayer })}
              />
              {preferences.useNativeMacPlayer ? (
                <SettingsField
                  label="Preferred player"
                  hint="Automatic tries the built-in AVPlayer window for common formats, then falls back to installed apps. QuickTime works best with MP4 and HLS streams."
                >
                  <SettingsSelect
                    value={preferences.macNativePlayer}
                    onChange={(value) => onUpdatePreferences({ macNativePlayer: value as MacNativePlayer })}
                  >
                    { (nativePlayers.length > 0 ? nativePlayers : macNativePlayerFallback).map((player) => (
                      <option key={player.id} value={player.id} disabled={!player.available}>
                        {player.label}
                        {!player.available ? ' (not installed)' : ''}
                      </option>
                    ))}
                  </SettingsSelect>
                </SettingsField>
              ) : null}
            </SettingsSection>
          ) : null}

          <SettingsSection title="Auto Play" first={!isMacTauri()}>
            <SettingsToggle
              label="Auto play resolved streams"
              hint="When streams load for a title, start playback with the top matching result."
              checked={preferences.autoPlayResolvedStreams}
              onChange={(autoPlayResolvedStreams) => onUpdatePreferences({ autoPlayResolvedStreams })}
            />
            <SettingsToggle
              label="Prefer cached results"
              hint="When ranking streams, boost Torbox-cached sources that start instantly."
              checked={preferences.preferCachedResults}
              onChange={(preferCachedResults) => onUpdatePreferences({ preferCachedResults })}
            />
            <SettingsToggle
              label="Auto-play next episode"
              hint="When an episode ends, load and play the next one in the season."
              checked={preferences.autoPlayNextEpisode}
              onChange={(autoPlayNextEpisode) => onUpdatePreferences({ autoPlayNextEpisode })}
            />
            <SettingsField
              label="Next episode countdown"
              hint="Delay before auto-playing the next episode. Gives you time to cancel."
            >
              <SettingsSelect
                value={preferences.nextEpisodeCountdown}
                onChange={(value) =>
                  onUpdatePreferences({ nextEpisodeCountdown: Number(value) as NextEpisodeCountdownSeconds })
                }
              >
                <option value={0}>Immediate</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds</option>
              </SettingsSelect>
            </SettingsField>
          </SettingsSection>

          <SettingsSection title="Stream Results">
            <SettingsField label="Results shown" hint="How many stream options appear before expanding the list.">
              <SettingsSelect
                value={preferences.compactResultsLimit}
                onChange={(value) => onUpdatePreferences({ compactResultsLimit: Number(value) })}
              >
                {[3, 4, 6, 8, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
            <SettingsToggle
              label="Expand stream results by default"
              hint="Show the full stream list instead of the compact preview."
              checked={preferences.expandStreamResultsByDefault}
              onChange={(expandStreamResultsByDefault) => onUpdatePreferences({ expandStreamResultsByDefault })}
            />
          </SettingsSection>

          <SettingsSection title="Resume & Progress">
            <SettingsField
              label="Minimum resume position"
              hint="Playback positions below this many seconds are ignored for Continue Watching."
            >
              <SettingsSelect
                value={preferences.resumeMinSeconds}
                onChange={(value) => onUpdatePreferences({ resumeMinSeconds: Number(value) })}
              >
                {[0, 15, 30, 60, 90, 120].map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? 'Any position' : `${value} seconds`}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
            <SettingsField
              label="Mark as finished at"
              hint="When you reach this percentage, the title is removed from Continue Watching."
            >
              <SettingsSelect
                value={preferences.completeRatioPercent}
                onChange={(value) => onUpdatePreferences({ completeRatioPercent: Number(value) })}
              >
                {[85, 90, 92, 95].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          </SettingsSection>

          <SettingsSection title="Notifications">
            <SettingsToggle
              label="Download completion notifications"
              hint="Show a macOS notification when a download finishes."
              checked={preferences.downloadNotifications}
              onChange={(downloadNotifications) => onUpdatePreferences({ downloadNotifications })}
            />
            <SettingsHint>macOS will ask for notification permission once. No Apple Developer certificate is required for local download alerts.</SettingsHint>
          </SettingsSection>
        </div>
      ) : null}

      {tab === 'downloads' ? (
        <div className="space-y-0">
          <SettingsSection title="Download Behavior" first>
            <SettingsToggle
              label="Always confirm download destination"
              hint="Show the destination picker even when a default destination is configured."
              checked={preferences.alwaysConfirmDownloadDestination}
              onChange={(alwaysConfirmDownloadDestination) => onUpdatePreferences({ alwaysConfirmDownloadDestination })}
            />
          </SettingsSection>

          <SettingsSection title="Destinations">
            <DownloadDestinationsSettings
              downloadConfig={downloadConfig}
              onUpdateDownloadConfig={onUpdateDownloadConfig}
            />
          </SettingsSection>
        </div>
      ) : null}

      {tab === 'integrations' ? (
        <div className="space-y-0">
          <SettingsSection
            title="Connected Services"
            description="Accounts you authenticate with API keys."
            first
          >
            <IntegrationsSettings
              torboxApiKey={torboxApiKey}
              jellyfinApiKey={jellyfinApiKey}
              downloadConfig={downloadConfig}
              preferences={preferences}
              onChangeTorboxApiKey={onChangeTorboxApiKey}
              onChangeJellyfinApiKey={onChangeJellyfinApiKey}
              onPatchDownloadConfig={(patch) => onUpdateDownloadConfig({ ...downloadConfig, ...patch })}
              onUpdatePreferences={onUpdatePreferences}
              onOpenJellyfinSignIn={onOpenJellyfinSignIn}
              onImportJellyfinWatchlist={onImportJellyfinWatchlist}
            />
          </SettingsSection>
          <SettingsSection title="Result Indexers" description={INDEXER_SOURCES_HINT}>
            <StreamIndexerSettings
              plugins={plugins}
              onUpdatePlugin={onUpdatePlugin}
              onPluginEnabledChange={handlePluginEnabledChange}
            />
          </SettingsSection>
        </div>
      ) : null}

      {tab === 'advanced' ? (
        <div className="space-y-0">
          <SettingsSection title="Custom Stream Profiles" first>
            <SettingsHint>Create profiles with your own resolution, size, and caching rules.</SettingsHint>
            <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[12px] font-semibold">Profiles</div>
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
                  <p className="text-[11px] text-[var(--mac-secondary)]">No custom profiles yet.</p>
                ) : null}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Network">
            <SettingsField
              label="Addon request timeout"
              hint="How long to wait for stream addon responses in the web app before showing an error."
            >
              <SettingsSelect
                value={preferences.apiRequestTimeoutSeconds}
                onChange={(value) =>
                  onUpdatePreferences({ apiRequestTimeoutSeconds: Number(value) as AppPreferences['apiRequestTimeoutSeconds'] })
                }
              >
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
              </SettingsSelect>
            </SettingsField>
          </SettingsSection>

          <SettingsSection title="Layout">
            <SettingsHint>Sidebar widths are saved automatically when you drag the panel dividers.</SettingsHint>
            <button
              type="button"
              onClick={onResetPanelSizes}
              className="h-8 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-3 text-[12px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
            >
              Reset panel sizes
            </button>
          </SettingsSection>

          <SettingsSection title="Keyboard Shortcuts">
            <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2.5 text-[12px] leading-5 text-[var(--mac-secondary)]">
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                <span>Focus search</span>
                <span className="font-mono text-[11px] text-[var(--mac-text)]">⌘F / ⌘K</span>
                <span>Open preferences</span>
                <span className="font-mono text-[11px] text-[var(--mac-text)]">⌘,</span>
                <span>Play top stream</span>
                <span className="font-mono text-[11px] text-[var(--mac-text)]">Enter</span>
                <span>Close panel / modal</span>
                <span className="font-mono text-[11px] text-[var(--mac-text)]">Esc</span>
                <span>Navigate library</span>
                <span className="font-mono text-[11px] text-[var(--mac-text)]">Arrow keys</span>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Settings Backup">
            <SettingsHint>Export preferences, plugins, layout, and filter presets. API keys are not included.</SettingsHint>
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
          </SettingsSection>
        </div>
      ) : null}
    </AppModal>
    <ConfirmationDialog
      open={Boolean(pendingPluginEnable)}
      title={THIRD_PARTY_ADDON_ENABLE_TITLE}
      message={pendingPluginEnable ? thirdPartyAddonEnableMessage(pendingPluginEnable.name) : ''}
      confirmLabel="Enable addon"
      confirmTone="primary"
      onConfirm={confirmPendingPluginEnable}
      onCancel={() => setPendingPluginEnable(null)}
    />
    </>
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
