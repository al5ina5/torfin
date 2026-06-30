import { describe, expect, it } from 'vitest'

import {
  EASY_TORBOX_PROFILES,
  buildCometDebridConfig,
  buildTorrentioConfigPath,
  encodeCometConfig,
  isLegacyBareTorrentioUrl,
} from '../plugin-urls'
import { hydrateUrl } from '../plugins'

describe('EASY_TORBOX_PROFILES', () => {
  it('matches easy-torbox.github.io quick profile defaults', () => {
    expect(EASY_TORBOX_PROFILES.netflix).toEqual({
      maxRes: 'all',
      sort: 'qualitysize',
      limit: '1',
      maxSize: 'all',
      language: 'none',
      cachedOnly: true,
      hideCams: true,
      hide3D: true,
    })
    expect(EASY_TORBOX_PROFILES.dataSaver.limit).toBe('3')
    expect(EASY_TORBOX_PROFILES.dataSaver.maxSize).toBe('5GB')
    expect(EASY_TORBOX_PROFILES.cinephile.limit).toBe('3')
  })
})

describe('buildTorrentioConfigPath', () => {
  it('builds netflix mode URL like easy-torbox', () => {
    const path = buildTorrentioConfigPath('abc123', 'netflix')
    expect(path).toBe(
      'sort=qualitysize|limit=1|qualityfilter=cam,screener,3d|debridoptions=nocatalog,nodownloadlinks|torbox=abc123',
    )
    expect(path).not.toContain('providers=')
  })

  it('builds data saver mode URL like easy-torbox', () => {
    const path = buildTorrentioConfigPath('abc123', 'dataSaver')
    expect(path).toBe(
      'sort=size|limit=3|sizefilter=5GB|qualityfilter=cam,screener,3d,4k|debridoptions=nocatalog,nodownloadlinks|torbox=abc123',
    )
  })

  it('builds cinephile mode URL like easy-torbox', () => {
    const path = buildTorrentioConfigPath('abc123', 'cinephile')
    expect(path).toBe(
      'sort=qualitysize|limit=3|qualityfilter=cam,screener,3d|debridoptions=nocatalog,nodownloadlinks|torbox=abc123',
    )
  })

  it('omits torbox when key is empty', () => {
    expect(buildTorrentioConfigPath('', 'netflix')).toBe(
      'sort=qualitysize|limit=1|qualityfilter=cam,screener,3d|debridoptions=nocatalog,nodownloadlinks',
    )
  })
})

describe('buildCometDebridConfig', () => {
  it('matches easy-torbox comet defaults for netflix mode', () => {
    const config = buildCometDebridConfig('key', 'netflix')
    expect(config.deduplicateStreams).toBe(true)
    expect(config.removeTrash).toBe(true)
    expect(config.cachedOnly).toBe(true)
    expect(config.maxResultsPerResolution).toBe(1)
    expect(config.scrapeDebridAccountTorrents).toBe(false)
    expect(config.options.allow_english_in_languages).toBe(true)
    expect(config.options.remove_unknown_languages).toBe(false)
    expect(config.debridServices[0]?.apiKey).toBe('key')
  })

  it('uses easy-torbox base64 encoding for comet config', () => {
    const config = buildCometDebridConfig('key', 'dataSaver')
    expect(encodeCometConfig(config)).toBe(
      btoa(unescape(encodeURIComponent(JSON.stringify(config)))),
    )
    expect(config.maxResultsPerResolution).toBe(3)
    expect(config.maxSize).toBe(5 * 1024 * 1024 * 1024)
    expect(config.resolutions.r2160p).toBe(false)
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
    expect(url).toContain('limit=1')
    expect(url).toContain('tt0111161')
    expect(url).not.toContain('{torrentioConfig}')
  })

  it('detects legacy bare torrentio urls', () => {
    expect(isLegacyBareTorrentioUrl('https://torrentio.strem.fun/stream/movie/{imdbId}.json')).toBe(true)
  })
})
