import type { AppPreferences, BuiltinResultProfile, CustomStreamProfile, ResultProfile } from '../types'

export const builtinProfileIds: BuiltinResultProfile[] = ['netflix', 'dataSaver', 'cinephile']

export const builtinProfileMeta: Record<BuiltinResultProfile, { label: string; description: string }> = {
  netflix: { label: 'Reliable', description: 'One best pick per quality tier — instant-play ready.' },
  dataSaver: { label: 'Fastest', description: 'Smaller files capped at 1080p for quicker downloads.' },
  cinephile: { label: 'Best', description: 'Top quality: 4K, HDR, Remux, and Blu-ray.' },
}

export function builtinProfileList() {
  return builtinProfileIds.map((id) => ({ id, ...builtinProfileMeta[id] }))
}

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
  const builtins = builtinProfileIds.map((id) => ({
    id: id as ResultProfile,
    ...builtinProfileMeta[id],
  }))
  const custom = preferences.customProfiles.map((profile) => ({
    id: profile.id as ResultProfile,
    label: profile.label,
    description: '',
  }))
  return [...builtins, ...custom]
}

export function findCustomProfile(preferences: AppPreferences, profileId: ResultProfile) {
  return preferences.customProfiles.find((profile) => profile.id === profileId)
}
