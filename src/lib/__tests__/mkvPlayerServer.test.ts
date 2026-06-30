import { describe, expect, it } from 'vitest'

import { mkvPlayerServer, mkvServerBaseUrl, shouldUseMkvServer } from '../mkvPlayerServer'

describe('mkvPlayerServer', () => {
  it('defaults server base URL to localhost helper port', () => {
    expect(mkvServerBaseUrl()).toBe('http://localhost:8787')
  })

  it('enables server mode for direct source playback URLs', () => {
    const source = 'https://cdn.example.com/movie.mkv'
    expect(shouldUseMkvServer(source, source)).toBe(true)
    expect(mkvPlayerServer(source, source)).toEqual({
      baseUrl: 'http://localhost:8787',
      enabled: true,
      delivery: 'hls',
    })
  })

  it('disables server mode for torbox transcode playlists', () => {
    const source = 'https://cdn.example.com/movie.mkv'
    const playback = 'http://127.0.0.1:3020/api/hls-transcode/session-1/index.m3u8'
    expect(shouldUseMkvServer(source, playback)).toBe(false)
    expect(mkvPlayerServer(source, playback).enabled).toBe(false)
  })
})
