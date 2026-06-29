import type { AppPreferences, DownloadConfig, PluginConfig } from '../types'
import { loadCustomFilterPresets } from './filter-presets'
import { STORAGE_KEYS, loadStoredJson } from './storage'

export const SETTINGS_EXPORT_VERSION = 1

export type SettingsExport = {
  version: number
  exportedAt: string
  preferences: AppPreferences
  plugins: PluginConfig[]
  downloadConfig: Omit<DownloadConfig, 'sshPassword' | 'jellyfinApiKey'> & {
    jellyfinApiKey: string
    sshPassword: string
  }
  layout: { leftSidebarWidth: number; rightSidebarWidth: number }
  filterPresets: ReturnType<typeof loadCustomFilterPresets>
  contentType: string
}

export function buildSettingsExport(
  preferences: AppPreferences,
  plugins: PluginConfig[],
  downloadConfig: DownloadConfig,
  layout: { leftSidebarWidth: number; rightSidebarWidth: number },
  contentType: string,
): SettingsExport {
  return {
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    preferences,
    plugins,
    downloadConfig: {
      ...downloadConfig,
      jellyfinApiKey: '',
      sshPassword: '',
    },
    layout,
    filterPresets: loadCustomFilterPresets(),
    contentType,
  }
}

export function parseSettingsExport(raw: string): SettingsExport {
  const parsed = JSON.parse(raw) as SettingsExport
  if (!parsed || typeof parsed !== 'object' || parsed.version !== SETTINGS_EXPORT_VERSION) {
    throw new Error('This settings file is not a valid Torfin export.')
  }
  return parsed
}

export function downloadSettingsFile(payload: SettingsExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `torfin-settings-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function loadPersistedLayout() {
  return loadStoredJson(STORAGE_KEYS.layout, { leftSidebarWidth: 220, rightSidebarWidth: 520 })
}
