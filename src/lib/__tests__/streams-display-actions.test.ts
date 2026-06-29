import { describe, expect, it } from 'vitest'

import type { StreamResult } from '../../types'
import { canPlayStream, downloadActionTitle } from '../streams-display'

const torrentStream: StreamResult = {
  pluginName: 'Torrentio',
  title: '1080p',
  infoHash: 'abc123',
  tags: [],
  rank: 1,
}

const directStream: StreamResult = {
  pluginName: 'Addon',
  title: 'Direct',
  url: 'https://cdn.example.com/movie.mkv',
  tags: [],
  rank: 1,
}

describe('stream action gating', () => {
  it('disables play for torrent streams without debrid', () => {
    expect(canPlayStream(torrentStream, '')).toBe(false)
    expect(canPlayStream(torrentStream, 'token')).toBe(true)
  })

  it('allows play for direct streams without debrid', () => {
    expect(canPlayStream(directStream, '')).toBe(true)
  })

  it('labels download actions by mode', () => {
    expect(downloadActionTitle('', torrentStream)).toBe('Save torrent file')
    expect(downloadActionTitle('token', torrentStream)).toBe('Import to library')
  })
})
