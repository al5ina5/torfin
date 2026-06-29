import { describe, expect, it } from 'vitest'

import {
  chooseFileId,
  extractInfoHash,
  extractTorrentId,
  hasSelectableVideoFile,
  isQueuedTorrentDetail,
  isRetriableTorboxError,
  isTorrentCached,
  isVideoFilename,
  normalizeAllowedFetchJsonUrl,
} from '../../../server/torbox.mjs'

describe('isQueuedTorrentDetail', () => {
  it('detects queued torrent messages', () => {
    expect(isQueuedTorrentDetail('Torrent queued for processing')).toBe(true)
    expect(isQueuedTorrentDetail('You will receive a notification when it is processed')).toBe(true)
    expect(isQueuedTorrentDetail('ready')).toBe(false)
  })
})

describe('isRetriableTorboxError', () => {
  it('flags transient server errors', () => {
    expect(isRetriableTorboxError('There was an error processing your request')).toBe(true)
    expect(isRetriableTorboxError('502 Bad Gateway')).toBe(true)
    expect(isRetriableTorboxError('404 not found')).toBe(false)
  })
})

describe('extractTorrentId', () => {
  it('extracts id from nested shapes', () => {
    expect(extractTorrentId({ data: { torrent_id: 42 } })).toBe(42)
    expect(extractTorrentId({ id: 7 })).toBe(7)
    expect(extractTorrentId({})).toBeNull()
    expect(extractTorrentId({ data: { torrent_id: -1 } })).toBeNull()
  })
})

describe('isTorrentCached', () => {
  it('detects cached torrents', () => {
    expect(isTorrentCached({ cached: true })).toBe(true)
    expect(isTorrentCached({ download_state: 'cached' })).toBe(true)
    expect(isTorrentCached({ state: 'completed' })).toBe(true)
    expect(isTorrentCached({ state: 'downloading' })).toBe(false)
  })
})

describe('hasSelectableVideoFile', () => {
  it('requires video files with numeric ids', () => {
    expect(hasSelectableVideoFile({ files: [{ id: 0, name: 'movie.mkv' }] })).toBe(true)
    expect(hasSelectableVideoFile({ files: [{ id: 0, name: 'readme.txt' }] })).toBe(false)
    expect(hasSelectableVideoFile({ files: [] })).toBe(false)
  })
})

describe('extractInfoHash', () => {
  it('extracts 40-char hex hashes', () => {
    const hash = 'a'.repeat(40)
    expect(extractInfoHash(`magnet:?xt=urn:btih:${hash}`)).toBe(hash)
    expect(extractInfoHash('no hash here')).toBeUndefined()
  })
})

describe('isVideoFilename', () => {
  it('matches common video extensions', () => {
    expect(isVideoFilename('movie.mkv')).toBe(true)
    expect(isVideoFilename('movie.MP4')).toBe(true)
    expect(isVideoFilename('readme.txt')).toBe(false)
  })
})

describe('chooseFileId', () => {
  const torrent = {
    files: [
      { id: 0, name: 'sample.mkv', size: 100 },
      { id: 1, name: 'movie.mkv', size: 9000 },
    ],
  }

  it('uses explicit fileIdx when valid', () => {
    expect(chooseFileId(torrent, 1, null)).toBe(1)
  })

  it('matches filename when provided', () => {
    expect(chooseFileId(torrent, null, 'movie.mkv')).toBe(1)
  })

  it('picks largest video file by default', () => {
    expect(chooseFileId(torrent, null, null)).toBe(1)
  })
})

describe('normalizeAllowedFetchJsonUrl', () => {
  it('allows cinemeta and plugin hosts', () => {
    expect(normalizeAllowedFetchJsonUrl('https://v3-cinemeta.strem.io/catalog/movie/top.json')).toContain('cinemeta')
    expect(normalizeAllowedFetchJsonUrl('https://torrentio.strem.fun/stream/movie/tt.json')).toContain('torrentio')
  })

  it('rejects unknown hosts', () => {
    expect(() => normalizeAllowedFetchJsonUrl('https://evil.example.com/data.json')).toThrow()
  })

  it('rejects invalid urls', () => {
    expect(() => normalizeAllowedFetchJsonUrl('not-a-url')).toThrow()
    expect(() => normalizeAllowedFetchJsonUrl('')).toThrow()
  })
})
