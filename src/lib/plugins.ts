import {
  COMET_STREAM_TEMPLATE,
  TORRENTIO_STREAM_TEMPLATE,
  buildCometDebridConfig,
  buildTorrentioConfigPath,
  isLegacyBareCometUrl,
  isLegacyBareTorrentioUrl,
} from './plugin-urls'
import { STORAGE_KEYS, loadStoredJson } from './storage'
import type { ContentType, Movie, PluginConfig } from '../types'

const legacyCometStreamUrlTemplate = 'https://comet.elfhosted.com/stream/movie/{imdbId}.json'
const legacyKnightcrawlerStreamUrlTemplate = 'https://knightcrawler.elfhosted.com/stream/movie/{imdbId}.json'

export const defaultPlugins: PluginConfig[] = [
  {
    id: 'torrentio',
    name: 'Torrentio',
    enabled: false,
    streamUrlTemplate: TORRENTIO_STREAM_TEMPLATE,
  },
  {
    id: 'comet',
    name: 'Comet',
    enabled: false,
    streamUrlTemplate: COMET_STREAM_TEMPLATE,
  },
  {
    id: 'aiostreams',
    name: 'AIOStreams',
    enabled: false,
    streamUrlTemplate: '',
  },
  {
    id: 'mediafusion',
    name: 'MediaFusion',
    enabled: false,
    streamUrlTemplate: '',
  },
]

export function normalizePluginConfig(plugin: PluginConfig): PluginConfig {
  if (plugin.id === 'torrentio' && isLegacyBareTorrentioUrl(plugin.streamUrlTemplate)) {
    return { ...plugin, streamUrlTemplate: TORRENTIO_STREAM_TEMPLATE }
  }
  if (plugin.id === 'comet') {
    if (plugin.streamUrlTemplate === legacyCometStreamUrlTemplate || isLegacyBareCometUrl(plugin.streamUrlTemplate)) {
      return { ...plugin, streamUrlTemplate: COMET_STREAM_TEMPLATE }
    }
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
  if (plugin.id === 'comet') return true
  return plugin.streamUrlTemplate.includes('{torboxApiKey}') || plugin.streamUrlTemplate.includes('{cometTorboxConfig}')
}

export function hasEnabledStreamSources(plugins: PluginConfig[]) {
  return plugins.some((plugin) => plugin.enabled && plugin.streamUrlTemplate.trim())
}

type SeriesSelection = { season: number; episode: number }

export function hydrateUrl(
  template: string,
  item: Movie,
  torboxApiKey: string,
  contentType: ContentType,
  seriesSelection?: SeriesSelection,
) {
  const cometTorboxConfig = encodeURIComponent(btoa(JSON.stringify(buildCometDebridConfig(torboxApiKey))))
  const torrentioConfig = buildTorrentioConfigPath(torboxApiKey)

  let url = template
    .replaceAll('{imdbId}', encodeURIComponent(item.id))
    .replaceAll('{torboxApiKey}', encodeURIComponent(torboxApiKey.trim()))
    .replaceAll('{torrentioConfig}', torrentioConfig)
    .replaceAll('{cometTorboxConfig}', cometTorboxConfig)

  if (contentType === 'series' && seriesSelection) {
    const episodeId = `${item.id}:${seriesSelection.season}:${seriesSelection.episode}`
    url = url.replace('/movie/', '/series/').replace(`/${encodeURIComponent(item.id)}.json`, `/${encodeURIComponent(episodeId)}.json`)
    url = url.replace(`/${item.id}.json`, `/${episodeId}.json`)
  }

  return url
}
