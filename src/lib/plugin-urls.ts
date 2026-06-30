/**
 * Torrentio / Comet URL builders — faithful port of easy-torbox/stremio index.html.
 * @see https://github.com/easy-torbox/stremio/blob/main/index.html
 */

import type { BuiltinResultProfile, CustomStreamProfile, ResultProfile } from '../types'

export const TORRENTIO_STREAM_TEMPLATE =
  'https://torrentio.strem.fun/{torrentioConfig}/stream/movie/{imdbId}.json'

export const COMET_STREAM_TEMPLATE =
  'https://comet.elfhosted.com/{cometTorboxConfig}/stream/movie/{imdbId}.json'

export type EasyTorboxMaxRes = 'all' | '1080p' | '720p'
export type EasyTorboxLanguage = 'none' | 'spanish' | 'french' | 'italian' | 'german' | 'portuguese' | 'hindi'

export type EasyTorboxPreset = {
  maxRes: EasyTorboxMaxRes
  sort: string
  limit: string
  maxSize: string
  language: EasyTorboxLanguage
  cachedOnly: boolean
  hideCams: boolean
  hide3D: boolean
}

/** Quick profiles from easy-torbox.github.io/stremio — Netflix / Data Saver / Cinephile. */
export const EASY_TORBOX_PROFILES: Record<BuiltinResultProfile, EasyTorboxPreset> = {
  netflix: {
    maxRes: 'all',
    sort: 'qualitysize',
    limit: '1',
    maxSize: 'all',
    language: 'none',
    cachedOnly: true,
    hideCams: true,
    hide3D: true,
  },
  dataSaver: {
    maxRes: '1080p',
    sort: 'size',
    limit: '3',
    maxSize: '5GB',
    language: 'none',
    cachedOnly: true,
    hideCams: true,
    hide3D: true,
  },
  cinephile: {
    maxRes: 'all',
    sort: 'qualitysize',
    limit: '3',
    maxSize: 'all',
    language: 'none',
    cachedOnly: true,
    hideCams: true,
    hide3D: true,
  },
}

const COMET_RESOLUTIONS = ['r2160p', 'r1440p', 'r1080p', 'r720p', 'r576p', 'r480p', 'r360p', 'r240p', 'unknown'] as const

function mapUiLanguageToCode(language: EasyTorboxLanguage) {
  const languageCodeMap: Partial<Record<EasyTorboxLanguage, string>> = {
    spanish: 'es',
    french: 'fr',
    italian: 'it',
    german: 'de',
    portuguese: 'pt',
    hindi: 'hi',
  }
  return languageCodeMap[language] ?? null
}

function cometResolutionsForMaxRes(maxRes: EasyTorboxMaxRes) {
  const enabled =
    {
      all: [...COMET_RESOLUTIONS],
      '1080p': ['r1080p', 'r720p', 'r576p', 'r480p', 'r360p', 'r240p', 'unknown'],
      '720p': ['r720p', 'r576p', 'r480p', 'r360p', 'r240p', 'unknown'],
    }[maxRes] ?? COMET_RESOLUTIONS

  return COMET_RESOLUTIONS.reduce<Record<string, boolean>>((disabled, resolution) => {
    if (!enabled.includes(resolution)) disabled[resolution] = false
    return disabled
  }, {})
}

export function easyTorboxPresetForProfile(
  profile: ResultProfile,
  customProfile?: CustomStreamProfile,
): EasyTorboxPreset {
  if (profile === 'netflix') return EASY_TORBOX_PROFILES.netflix
  if (profile === 'dataSaver') return EASY_TORBOX_PROFILES.dataSaver
  if (profile === 'cinephile') return EASY_TORBOX_PROFILES.cinephile

  if (customProfile) {
    const maxRes: EasyTorboxMaxRes =
      customProfile.maxResolution === 720
        ? '720p'
        : customProfile.maxResolution && customProfile.maxResolution < 2160
          ? '1080p'
          : 'all'

    return {
      maxRes,
      sort: maxRes === '1080p' || maxRes === '720p' ? 'size' : 'qualitysize',
      limit: String(Math.min(Math.max(customProfile.maxResults, 1), 10)),
      maxSize: customProfile.maxFileSizeGb > 0 ? `${customProfile.maxFileSizeGb}GB` : 'all',
      language: 'none',
      cachedOnly: customProfile.preferCached,
      hideCams: customProfile.hideCam,
      hide3D: customProfile.hide3d,
    }
  }

  return EASY_TORBOX_PROFILES.netflix
}

/** Mirrors easy-torbox `updateLink()` torrentio branch. */
export function buildTorrentioConfigPath(
  torboxApiKey: string,
  profile: ResultProfile = 'netflix',
  customProfile?: CustomStreamProfile,
) {
  const preset = easyTorboxPresetForProfile(profile, customProfile)
  const configParts = [`sort=${preset.sort}`]

  if (preset.limit !== 'all') configParts.push(`limit=${preset.limit}`)
  if (preset.maxSize !== 'all') configParts.push(`sizefilter=${preset.maxSize}`)
  if (preset.language !== 'none') configParts.push(`language=${preset.language}`)

  const excludedQualities: string[] = []
  if (preset.hideCams) excludedQualities.push('cam', 'screener')
  if (preset.hide3D) excludedQualities.push('3d')
  if (preset.maxRes === '1080p') excludedQualities.push('4k')
  if (preset.maxRes === '720p') excludedQualities.push('4k', '1080p')
  if (excludedQualities.length > 0) configParts.push(`qualityfilter=${excludedQualities.join(',')}`)

  const debridOpts = ['nocatalog']
  if (preset.cachedOnly) debridOpts.push('nodownloadlinks')
  configParts.push(`debridoptions=${debridOpts.join(',')}`)

  const key = torboxApiKey.trim()
  if (key) configParts.push(`torbox=${key}`)

  return configParts.join('|')
}

/** Mirrors easy-torbox `updateLink()` comet branch with default advanced toggles. */
export function buildCometDebridConfig(
  torboxApiKey: string,
  profile: ResultProfile = 'netflix',
  customProfile?: CustomStreamProfile,
) {
  const preset = easyTorboxPresetForProfile(profile, customProfile)
  const maxSizeBytes =
    preset.maxSize === 'all' || preset.maxSize === 'none'
      ? 0
      : Number(preset.maxSize.replace('GB', '')) * 1024 * 1024 * 1024
  const preferredLanguageCode = mapUiLanguageToCode(preset.language)

  return {
    maxResultsPerResolution: preset.limit === 'all' ? 0 : Number(preset.limit),
    maxSize: maxSizeBytes,
    cachedOnly: preset.cachedOnly,
    sortCachedUncachedTogether: false,
    removeTrash: preset.hideCams,
    resultFormat: ['all'],
    debridServices: [{ service: 'torbox', apiKey: torboxApiKey.trim() }],
    enableTorrent: false,
    deduplicateStreams: true,
    scrapeDebridAccountTorrents: false,
    debridStreamProxyPassword: '',
    languages: {
      required: [],
      allowed: [],
      exclude: [],
      preferred: preferredLanguageCode ? [preferredLanguageCode] : [],
    },
    resolutions: cometResolutionsForMaxRes(preset.maxRes),
    options: {
      remove_ranks_under: -10_000_000_000,
      allow_english_in_languages: true,
      remove_unknown_languages: false,
    },
  }
}

/** easy-torbox uses btoa(unescape(encodeURIComponent(JSON.stringify(obj)))) for Comet. */
export function encodeCometConfig(config: ReturnType<typeof buildCometDebridConfig>) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(config))))
}

const LEGACY_BARE_TORRENTIO = /^https:\/\/torrentio\.strem\.fun\/stream\//
const LEGACY_BARE_COMET = /^https:\/\/comet\.elfhosted\.com\/stream\//

export function isLegacyBareTorrentioUrl(template: string) {
  return LEGACY_BARE_TORRENTIO.test(template)
}

export function isLegacyBareCometUrl(template: string) {
  return LEGACY_BARE_COMET.test(template)
}
