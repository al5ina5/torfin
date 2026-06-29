import { describe, expect, it } from 'vitest'

import {
  chooseFileId,
  extractTorrentId,
  hasSelectableVideoFile,
  isQueuedTorrentDetail,
  isRetriableTorboxError,
  isTorrentCached,
  normalizeAllowedFetchJsonUrl,
} from '../torbox'

describe('chooseFileId', () => {
  it('uses indexed file when it is a video with numeric id', () => {
    const torrent = {
      files: [
        { id: 10, name: 'sample.nfo', size: 200 },
        { id: 11, name: 'movie.mkv', size: 1024 },
      ],
    }
    expect(chooseFileId(torrent, 1)).toBe(11)
  })

  it('matches filename when provided', () => {
    const torrent = {
      files: [
        { id: 21, name: 'Another.Movie.2025.1080p.mkv', size: 2000 },
        { id: 22, name: 'readme.txt', size: 20 },
      ],
    }
    expect(chooseFileId(torrent, Number.NaN, 'Another.Movie.2025.1080p')).toBe(21)
  })

  it('falls back to largest playable video', () => {
    const torrent = {
      files: [
        { id: 30, name: 'small.mp4', size: 500 },
        { id: 31, name: 'large.mkv', size: 2500 },
      ],
    }
    expect(chooseFileId(torrent, Number.NaN)).toBe(31)
  })

  it('falls back to first numeric file id then zero', () => {
    expect(
      chooseFileId(
        {
          files: [{ id: '7', name: 'note.txt' }],
        },
        Number.NaN,
      ),
    ).toBe(7)

    expect(chooseFileId({ files: [{ id: 'not-a-number', name: 'note.txt' }] }, Number.NaN)).toBe(0)
    expect(chooseFileId({ files: 'invalid' } as unknown as Parameters<typeof chooseFileId>[0], Number.NaN)).toBe(0)
  })
})

describe('extractTorrentId', () => {
  it('reads positive torrent ids from common response shapes', () => {
    expect(extractTorrentId({ data: { torrent_id: 42 } })).toBe(42)
    expect(extractTorrentId({ data: { id: 7 } })).toBe(7)
    expect(extractTorrentId({ torrent_id: 99 })).toBe(99)
  })

  it('ignores missing or zero ids', () => {
    expect(extractTorrentId({ data: { torrent_id: 0 } })).toBeNull()
    expect(extractTorrentId({ detail: 'Torrent queued successfully.' })).toBeNull()
  })
})

describe('isQueuedTorrentDetail', () => {
  it('detects queued torrent responses', () => {
    expect(isQueuedTorrentDetail('Torrent queued successfully.')).toBe(true)
    expect(isQueuedTorrentDetail('Torrent creation request has been queued. You will receive a notification when it is processed.')).toBe(true)
    expect(isQueuedTorrentDetail('Torrent Added Successfully')).toBe(false)
  })
})

describe('isRetriableTorboxError', () => {
  it('retries generic Torbox processing failures', () => {
    expect(isRetriableTorboxError('There was an error processing your request. Please try again later.')).toBe(true)
    expect(isRetriableTorboxError('Add your Torbox API key before resolving Torbox results.')).toBe(false)
  })
})

describe('isTorrentCached', () => {
  it('detects cached torrent states', () => {
    expect(isTorrentCached({ cached: true })).toBe(true)
    expect(isTorrentCached({ download_state: 'cached' })).toBe(true)
    expect(isTorrentCached({ state: 'downloading' })).toBe(false)
  })
})

describe('hasSelectableVideoFile', () => {
  it('requires a video file with a numeric id', () => {
    expect(hasSelectableVideoFile({ files: [{ id: 1, name: 'movie.mkv' }] })).toBe(true)
    expect(hasSelectableVideoFile({ files: [{ id: 1, name: 'readme.txt' }] })).toBe(false)
    expect(hasSelectableVideoFile({ files: [{ name: 'movie.mkv' }] })).toBe(false)
  })
})

describe('normalizeAllowedFetchJsonUrl', () => {
  it('accepts listed allowlist hosts', () => {
    expect(normalizeAllowedFetchJsonUrl('https://v3-cinemeta.strem.io/catalog/movie/top.json')).toBe('https://v3-cinemeta.strem.io/catalog/movie/top.json')
    expect(normalizeAllowedFetchJsonUrl('https://torrentio.strem.fun/stream/movie/tt0111161.json')).toBe('https://torrentio.strem.fun/stream/movie/tt0111161.json')
    expect(normalizeAllowedFetchJsonUrl('https://api.torbox.app/v1/api/torrents/mylist')).toBe('https://api.torbox.app/v1/api/torrents/mylist')
  })

  it('accepts strem.io root and subdomains', () => {
    expect(normalizeAllowedFetchJsonUrl('https://strem.io')).toBe('https://strem.io/')
    expect(normalizeAllowedFetchJsonUrl('https://v3-cinemeta.strem.io/catalog/movie/imdbRating.json')).toBe('https://v3-cinemeta.strem.io/catalog/movie/imdbRating.json')
  })

  it('rejects non-http protocols', () => {
    expect(() => normalizeAllowedFetchJsonUrl('ftp://v3-cinemeta.strem.io/catalog/movie/top.json')).toThrow(
      'JSON fetches only support HTTP and HTTPS URLs.',
    )
  })

  it('rejects hosts outside the allowlist', () => {
    expect(() => normalizeAllowedFetchJsonUrl('https://example.com/data.json')).toThrow(
      'Host example.com is not in the JSON fetch allowlist.',
    )
  })
})
