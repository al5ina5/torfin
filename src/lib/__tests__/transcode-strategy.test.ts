import { describe, expect, it } from 'vitest'

import {
  playbackPrepareStatus,
  resolveSubtitleMode,
  resolveTranscodePlan,
  transcodeStatusLabel,
} from '../transcode-strategy'

describe('resolveSubtitleMode', () => {
  it('treats text codecs as soft subtitles', () => {
    expect(resolveSubtitleMode('subrip')).toBe('soft')
    expect(resolveSubtitleMode('ass')).toBe('soft')
    expect(resolveSubtitleMode('webvtt')).toBe('soft')
  })

  it('treats image codecs as burn-in subtitles', () => {
    expect(resolveSubtitleMode('hdmv_pgs_subtitle')).toBe('burn')
    expect(resolveSubtitleMode('dvd_subtitle')).toBe('burn')
  })
})

describe('resolveTranscodePlan', () => {
  it('uses copy mode for h264 + aac mkv without subtitles', () => {
    const plan = resolveTranscodePlan({
      videoCodec: 'h264',
      audioTracks: [{ index: 1, codec: 'aac' }],
      subtitleTracks: [],
    })
    expect(plan.mode).toBe('copy')
  })

  it('uses remux mode when only audio needs conversion', () => {
    const plan = resolveTranscodePlan({
      videoCodec: 'h264',
      audioTracks: [{ index: 1, codec: 'ac3' }],
      subtitleTracks: [],
    })
    expect(plan.mode).toBe('remux')
  })

  it('uses transcode mode for hevc video', () => {
    const plan = resolveTranscodePlan({
      videoCodec: 'hevc',
      audioTracks: [{ index: 1, codec: 'aac' }],
      subtitleTracks: [],
    })
    expect(plan.mode).toBe('transcode')
  })

  it('uses transcode mode for pgs subtitles', () => {
    const plan = resolveTranscodePlan({
      videoCodec: 'h264',
      audioTracks: [{ index: 1, codec: 'aac' }],
      subtitleTracks: [{ index: 3, codec: 'hdmv_pgs_subtitle' }],
    }, null, 3)
    expect(plan.mode).toBe('transcode')
    expect(plan.subtitleMode).toBe('burn')
  })

  it('keeps remux mode for soft text subtitles', () => {
    const plan = resolveTranscodePlan({
      videoCodec: 'h264',
      audioTracks: [{ index: 1, codec: 'aac' }],
      subtitleTracks: [{ index: 2, codec: 'subrip' }],
    }, null, 2)
    expect(plan.mode).toBe('copy')
    expect(plan.subtitleMode).toBe('soft')
  })
})

describe('transcodeStatusLabel', () => {
  it('maps modes to user-facing labels', () => {
    expect(transcodeStatusLabel('copy')).toBe('Starting')
    expect(transcodeStatusLabel('remux')).toBe('Remuxing')
    expect(transcodeStatusLabel('transcode')).toBe('Transcoding')
  })
})

describe('playbackPrepareStatus', () => {
  it('returns Preparing when tracks are explicitly selected', () => {
    expect(playbackPrepareStatus({
      videoCodec: 'h264',
      audioTracks: [{ index: 1, codec: 'aac' }],
      subtitleTracks: [],
    }, 1, null)).toBe('Preparing')
  })
})
