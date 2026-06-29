/** Torrentio / Comet URL builders — mirrors easy-torbox/stremio preset filtering. */

export const TORRENTIO_STREAM_TEMPLATE =
  'https://torrentio.strem.fun/{torrentioConfig}/stream/movie/{imdbId}.json'

export const COMET_STREAM_TEMPLATE =
  'https://comet.elfhosted.com/{cometTorboxConfig}/stream/movie/{imdbId}.json'

export function buildTorrentioConfigPath(torboxApiKey: string) {
  const parts = [
    'sort=qualitysize',
    'limit=3',
    'debridoptions=nocatalog,nodownloadlinks',
    'qualityfilter=cam,screener,3d',
  ]
  const key = torboxApiKey.trim()
  if (key) parts.push(`torbox=${key}`)
  return parts.join('|')
}

export function buildCometDebridConfig(torboxApiKey: string) {
  return {
    maxResultsPerResolution: 3,
    maxSize: 0,
    cachedOnly: false,
    sortCachedUncachedTogether: false,
    removeTrash: true,
    resultFormat: ['all'],
    debridServices: [{ service: 'torbox', apiKey: torboxApiKey.trim() }],
    enableTorrent: false,
    deduplicateStreams: true,
    scrapeDebridAccountTorrents: false,
    debridStreamProxyPassword: '',
    languages: { required: [], allowed: [], exclude: [], preferred: [] },
    resolutions: {},
    options: {
      remove_ranks_under: -10_000_000_000,
      allow_english_in_languages: true,
      remove_unknown_languages: false,
    },
  }
}

const LEGACY_BARE_TORRENTIO = /^https:\/\/torrentio\.strem\.fun\/stream\//
const LEGACY_BARE_COMET = /^https:\/\/comet\.elfhosted\.com\/stream\//

export function isLegacyBareTorrentioUrl(template: string) {
  return LEGACY_BARE_TORRENTIO.test(template)
}

export function isLegacyBareCometUrl(template: string) {
  return LEGACY_BARE_COMET.test(template)
}
