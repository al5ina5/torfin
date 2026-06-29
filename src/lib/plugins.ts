import { STORAGE_KEYS, loadStoredJson } from './storage'
import type { ContentType, Movie, PluginConfig } from '../types'

const legacyCometStreamUrlTemplate = 'https://comet.elfhosted.com/stream/movie/{imdbId}.json'
const cometTorboxStreamUrlTemplate = 'https://comet.elfhosted.com/{cometTorboxConfig}/stream/movie/{imdbId}.json'
const legacyKnightcrawlerStreamUrlTemplate = 'https://knightcrawler.elfhosted.com/stream/movie/{imdbId}.json'

export const defaultPlugins: PluginConfig[] = [
  {
    id: 'torrentio',
    name: 'Torrentio',
    enabled: false,
    streamUrlTemplate: 'https://torrentio.strem.fun/stream/movie/{imdbId}.json',
  },
]

export function normalizePluginConfig(plugin: PluginConfig): PluginConfig {
  if (plugin.id === 'comet' && plugin.streamUrlTemplate === legacyCometStreamUrlTemplate) {
    return { ...plugin, streamUrlTemplate: cometTorboxStreamUrlTemplate }
  }
  if (plugin.id === 'knightcrawler' && plugin.streamUrlTemplate === legacyKnightcrawlerStreamUrlTemplate) {
    return { ...plugin, enabled: false }
  }
  return plugin
}

export function loadSavedPlugins() {
  const parsed = loadStoredJson<PluginConfig[]>(STORAGE_KEYS.plugins, [])
  if (!parsed.length) return defaultPlugins
  const parsedById = new Map(parsed.map((plugin) => [plugin.id, normalizePluginConfig(plugin)]))
  return defaultPlugins.map((plugin) => parsedById.get(plugin.id) ?? plugin)
}

export function pluginNeedsTorboxKey(plugin: PluginConfig) {
  return plugin.streamUrlTemplate.includes('{torboxApiKey}') || plugin.streamUrlTemplate.includes('{cometTorboxConfig}')
}

type SeriesSelection = { season: number; episode: number }

export function hydrateUrl(
  template: string,
  item: Movie,
  torboxApiKey: string,
  contentType: ContentType,
  seriesSelection?: SeriesSelection,
) {
  const cometTorboxConfig = btoa(JSON.stringify({
    debridServices: [{ service: 'torbox', apiKey: torboxApiKey.trim() }],
  }))

  let url = template
    .replaceAll('{imdbId}', encodeURIComponent(item.id))
    .replaceAll('{torboxApiKey}', encodeURIComponent(torboxApiKey.trim()))
    .replaceAll('{cometTorboxConfig}', encodeURIComponent(cometTorboxConfig))

  if (contentType === 'series' && seriesSelection) {
    const episodeId = `${item.id}:${seriesSelection.season}:${seriesSelection.episode}`
    url = url.replace('/movie/', '/series/').replace(`/${encodeURIComponent(item.id)}.json`, `/${encodeURIComponent(episodeId)}.json`)
    url = url.replace(`/${item.id}.json`, `/${episodeId}.json`)
  }

  return url
}
