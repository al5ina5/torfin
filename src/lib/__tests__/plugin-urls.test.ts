import { describe, expect, it } from 'vitest'

import {
  buildCometDebridConfig,
  buildTorrentioConfigPath,
  isLegacyBareTorrentioUrl,
} from '../plugin-urls'
import { hydrateUrl } from '../plugins'

describe('buildTorrentioConfigPath', () => {
  it('includes quality filters and torbox key when present', () => {
    const path = buildTorrentioConfigPath('abc123')
    expect(path).toContain('sort=qualitysize')
    expect(path).toContain('limit=3')
    expect(path).toContain('qualityfilter=cam,screener,3d')
    expect(path).toContain('nodownloadlinks')
    expect(path).toContain('torbox=abc123')
  })

  it('omits torbox when key is empty', () => {
    expect(buildTorrentioConfigPath('')).not.toContain('torbox=')
  })
})

describe('buildCometDebridConfig', () => {
  it('dedupes and removes trash', () => {
    const config = buildCometDebridConfig('key')
    expect(config.deduplicateStreams).toBe(true)
    expect(config.removeTrash).toBe(true)
    expect(config.debridServices[0]?.apiKey).toBe('key')
  })
})

describe('hydrateUrl torrentio config', () => {
  const movie = { id: 'tt0111161', name: 'Shawshank', type: 'movie' as const }

  it('replaces torrentio config placeholder', () => {
    const url = hydrateUrl(
      'https://torrentio.strem.fun/{torrentioConfig}/stream/movie/{imdbId}.json',
      movie,
      'tok',
      'movie',
    )
    expect(url).toContain('torbox=tok')
    expect(url).toContain('tt0111161')
    expect(url).not.toContain('{torrentioConfig}')
  })

  it('detects legacy bare torrentio urls', () => {
    expect(isLegacyBareTorrentioUrl('https://torrentio.strem.fun/stream/movie/{imdbId}.json')).toBe(true)
  })
})
