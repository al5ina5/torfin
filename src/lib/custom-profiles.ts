import type { AppPreferences, BuiltinResultProfile, CustomStreamProfile, ResultProfile } from '../types'

export const builtinProfileIds: BuiltinResultProfile[] = ['netflix', 'dataSaver', 'cinephile']

export function isBuiltinProfile(profile: ResultProfile): profile is BuiltinResultProfile {
  return builtinProfileIds.includes(profile as BuiltinResultProfile)
}

export function defaultCustomProfile(id = `custom-${Date.now()}`): CustomStreamProfile {
  return {
    id,
    label: 'Custom',
    maxResolution: 1080,
    minResolution: 0,
    maxFileSizeGb: 0,
    hideCam: true,
    hide3d: true,
    preferCached: true,
    maxResults: 6,
    onePerResolution: false,
  }
}

export function allProfileOptions(preferences: AppPreferences) {
  const builtins = [
    { id: 'netflix' as ResultProfile, label: 'Netflix' },
    { id: 'dataSaver' as ResultProfile, label: 'Data Saver' },
    { id: 'cinephile' as ResultProfile, label: 'Cinephile' },
  ]
  const custom = preferences.customProfiles.map((profile) => ({
    id: profile.id as ResultProfile,
    label: profile.label,
  }))
  return [...builtins, ...custom]
}

export function findCustomProfile(preferences: AppPreferences, profileId: ResultProfile) {
  return preferences.customProfiles.find((profile) => profile.id === profileId)
}
