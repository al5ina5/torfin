import type { AppPreferences, BuiltinResultProfile, CustomStreamProfile, ResultProfile } from '../types'

export const builtinProfileIds: BuiltinResultProfile[] = ['netflix', 'dataSaver', 'cinephile']

export const builtinProfileMeta: Record<BuiltinResultProfile, { label: string; description: string }> = {
  netflix: { label: 'Reliable', description: '1 instant-play link per quality — easy-torbox Netflix mode.' },
  dataSaver: { label: 'Fastest', description: 'Smaller 1080p links (≤5 GB) — easy-torbox Data Saver mode.' },
  cinephile: { label: 'Best', description: 'Top quality picks without overwhelming results — easy-torbox Cinephile mode.' },
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
