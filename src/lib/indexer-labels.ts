const INDEXER_DESCRIPTIONS: Record<string, string> = {
  torrentio: 'Primary indexer with quality filters and Torbox instant-play when connected.',
  comet: 'Alternate indexer with deduplication, routed through your Torbox account.',
  aiostreams: 'Aggregates multiple indexers. Paste your configured stream URL from AIOStreams setup.',
  mediafusion: 'Regional and quality-filtered sources. Paste your configured MediaFusion stream URL.',
}

export function indexerDescription(pluginId: string) {
  return INDEXER_DESCRIPTIONS[pluginId] ?? 'Stremio-compatible stream endpoint.'
}

export const INDEXER_ORDER = ['torrentio', 'comet', 'aiostreams', 'mediafusion'] as const

export const PRIMARY_INDEXER_IDS = ['torrentio', 'comet'] as const
export const OPTIONAL_INDEXER_IDS = ['aiostreams', 'mediafusion'] as const

export function optionalIndexerSetupHint(pluginId: string) {
  if (pluginId === 'aiostreams') {
    return 'Enable AIOStreams in its web UI, add Torbox, then paste the stream URL template here (must include {imdbId}).'
  }
  if (pluginId === 'mediafusion') {
    return 'Configure MediaFusion with Torbox, then paste the stream URL template here (must include {imdbId}).'
  }
  return ''
}
