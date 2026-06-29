const INDEXER_DESCRIPTIONS: Record<string, string> = {
  torrentio: 'Stremio-compatible indexer for release lookups.',
  comet: 'Stremio-compatible indexer routed through your Torbox account.',
}

export function indexerDescription(pluginId: string) {
  return INDEXER_DESCRIPTIONS[pluginId] ?? 'Stremio-compatible metadata endpoint.'
}

export const INDEXER_ORDER = ['torrentio', 'comet'] as const
