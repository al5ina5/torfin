import { describe, expect, it } from 'vitest'

import type { StreamResult } from '../../types'
import {
  buildMagnetLink,
  canExportTorrent,
  shouldExportTorrent,
  usesMediaImportPath,
} from '../torrent-export'

const torrentStream: StreamResult = {
  pluginName: 'Torrentio',
  title: '1080p release',
  infoHash: 'abc123def456',
  tags: ['1080p'],
  rank: 1,
}

const directStream: StreamResult = {
  pluginName: 'Addon',
  title: 'Direct',
  url: 'https://cdn.example.com/movie.mkv',
  tags: [],
  rank: 1,
}

describe('torrent export helpers', () => {
  it('builds magnet links from info hashes', () => {
    expect(buildMagnetLink(torrentStream)).toContain('magnet:?xt=urn:btih:abc123def456')
  })

  it('exports torrents when debrid is missing', () => {
    expect(shouldExportTorrent('', torrentStream)).toBe(true)
    expect(usesMediaImportPath('', torrentStream)).toBe(false)
  })

  it('imports media when debrid is present', () => {
    expect(shouldExportTorrent('token', torrentStream)).toBe(false)
    expect(usesMediaImportPath('token', torrentStream)).toBe(true)
  })

  it('imports direct http streams without debrid', () => {
    expect(canExportTorrent(directStream)).toBe(false)
    expect(shouldExportTorrent('', directStream)).toBe(false)
    expect(usesMediaImportPath('', directStream)).toBe(true)
  })
})
