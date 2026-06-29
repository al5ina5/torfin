import { describe, expect, it } from 'vitest'

import { isBrowserPlayableUrl, needsTranscodeFallback, shouldTranscodeDirectly } from '../playback'

describe('isBrowserPlayableUrl', () => {
  it('treats common browser formats as playable', () => {
    expect(isBrowserPlayableUrl('https://cdn.example.com/movie.mp4')).toBe(true)
    expect(isBrowserPlayableUrl('https://cdn.example.com/live/playlist.m3u8')).toBe(true)
  })

  it('treats mkv and avi as not playable', () => {
    expect(isBrowserPlayableUrl('https://cdn.example.com/movie.mkv')).toBe(false)
    expect(isBrowserPlayableUrl('https://cdn.example.com/movie.avi')).toBe(false)
  })

  it('treats extensionless Torbox links as not playable', () => {
    expect(isBrowserPlayableUrl('https://cdn.example.com/download/abc123')).toBe(false)
  })
})

describe('shouldTranscodeDirectly', () => {
  it('transcodes non-browser formats by default', () => {
    expect(shouldTranscodeDirectly('https://cdn.example.com/movie.mkv', null, null)).toBe(true)
  })

  it('keeps direct playback for mp4 when no tracks are selected', () => {
    expect(shouldTranscodeDirectly('https://cdn.example.com/movie.mp4', null, null)).toBe(false)
  })
})

describe('needsTranscodeFallback', () => {
  it('falls back when direct playback still points at the source url', () => {
    expect(needsTranscodeFallback('https://cdn.example.com/movie.mkv', 'https://cdn.example.com/movie.mkv')).toBe(true)
    expect(needsTranscodeFallback('https://cdn.example.com/movie.mp4', 'https://cdn.example.com/movie.mp4')).toBe(true)
  })

  it('does not fall back after switching to hls', () => {
    expect(needsTranscodeFallback('https://cdn.example.com/movie.mkv', '/api/hls-transcode/id/playlist.m3u8')).toBe(false)
  })
})
