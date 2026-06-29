import { describe, expect, it } from 'vitest'

import { SETTINGS_EXPORT_VERSION, buildSettingsExport, parseSettingsExport } from '../settings-export'
import { defaultDownloadConfig } from '../downloads'
import { defaultPreferences } from '../preferences'

describe('settings export', () => {
  const base = buildSettingsExport(
    defaultPreferences,
    [],
    { ...defaultDownloadConfig, jellyfinApiKey: 'secret', sshPassword: 'pw' },
    { leftSidebarWidth: 220, rightSidebarWidth: 520 },
    'movie',
  )

  it('strips secrets from export', () => {
    expect(base.downloadConfig.jellyfinApiKey).toBe('')
    expect(base.downloadConfig.sshPassword).toBe('')
    expect(base.version).toBe(SETTINGS_EXPORT_VERSION)
  })

  it('parses valid export', () => {
    const parsed = parseSettingsExport(JSON.stringify(base))
    expect(parsed.preferences).toEqual(defaultPreferences)
  })

  it('rejects invalid version', () => {
    expect(() => parseSettingsExport(JSON.stringify({ version: 99 }))).toThrow('valid Torfin export')
  })

  it('rejects malformed json', () => {
    expect(() => parseSettingsExport('not json')).toThrow()
  })
})
