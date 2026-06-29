import { useEffect, useMemo, useRef, useState } from 'react'

import { getHlsTranscodeProgress } from '../lib/playback'
import type { HlsTranscodeProgress, MediaInfo } from '../types'

const WHIMSICAL_MESSAGES = [
  'Cueing the orchestra…',
  'Dusting off the film reels…',
  'The projectionist is on their way…',
  'Warming up the popcorn machine…',
  'Adjusting the focus…',
  'Loading the credits no one reads…',
  'Finding the good seats…',
  'Shushing the audience…',
  'Rewinding the tape…',
  'Polishing the Oscar…',
  'Checking the director\'s cut…',
  'Rolling camera…',
  'Scene 1, take 1…',
  'Dimming the house lights…',
  'Threading the projector…',
  'Fetching more butter for the popcorn…',
]

const TRANSCODE_STATUSES = new Set(['Transcoding', 'Preparing', 'Remuxing', 'Starting'])

function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  if (minutes > 0) return `${minutes}:${String(remainder).padStart(2, '0')}`
  return `${remainder}s`
}

function formatElapsed(ms: number) {
  return formatClock(ms / 1000)
}

export type PlaybackStatusDetails = {
  whimsical: string
  detail: string
  progress: number | null
  stalled: boolean
}

export function usePlaybackStatusProgress(status: string, mediaInfo: MediaInfo | null): PlaybackStatusDetails {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [progress, setProgress] = useState<HlsTranscodeProgress | null>(null)
  const [whimsicalIndex, setWhimsicalIndex] = useState(0)
  const startedAtRef = useRef(0)
  const lastSegmentRef = useRef(0)
  const lastSegmentAtRef = useRef(0)

  const isTranscoding = TRANSCODE_STATUSES.has(status)

  useEffect(() => {
    if (!status) return
    startedAtRef.current = Date.now()
    lastSegmentRef.current = 0
    lastSegmentAtRef.current = Date.now()
    setElapsedMs(0)
    setProgress(null)
    setWhimsicalIndex(0)
  }, [status])

  useEffect(() => {
    if (!status) return
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 500)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => {
    if (!status) return
    const timer = window.setInterval(() => {
      setWhimsicalIndex((value) => value + 1)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => {
    if (!isTranscoding) {
      setProgress(null)
      return
    }

    let cancelled = false

    const poll = async () => {
      const next = await getHlsTranscodeProgress()
      if (cancelled) return
      if (next.segmentCount > lastSegmentRef.current) {
        lastSegmentRef.current = next.segmentCount
        lastSegmentAtRef.current = Date.now()
      }
      setProgress(next)
    }

    void poll()
    const timer = window.setInterval(() => {
      void poll()
    }, 500)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isTranscoding, status])

  return useMemo(() => {
    const whimsical = WHIMSICAL_MESSAGES[whimsicalIndex % WHIMSICAL_MESSAGES.length] ?? WHIMSICAL_MESSAGES[0]
    const elapsed = formatElapsed(elapsedMs)
    const duration = mediaInfo?.duration
    const segmentCount = progress?.segmentCount ?? 0
    const transcodedSeconds = progress?.transcodedSeconds ?? 0
    const sinceLastSegmentMs = Date.now() - lastSegmentAtRef.current
    const stalled = Boolean(isTranscoding && (
      (segmentCount === 0 && elapsedMs >= 8000)
      || (segmentCount > 0 && sinceLastSegmentMs >= 15000 && progress?.processRunning)
      || (progress?.active && !progress.processRunning && !progress.playlistReady)
    ))

    let detail = `Working · ${elapsed}`
    let progressValue: number | null = null

    if (status === 'Opening') {
      detail = `Connecting to stream · ${elapsed}`
    } else if (status === 'Resolving') {
      detail = `Fetching stream link · ${elapsed}`
    } else if (status === 'Refreshing link') {
      detail = `Getting a fresh CDN link · ${elapsed}`
    } else if (status === 'Loading next episode') {
      detail = `Loading next episode · ${elapsed}`
    } else if (status === 'Retrying playback') {
      detail = `Recovering playback · ${elapsed}`
    } else if (status === 'Remuxing') {
      detail = segmentCount === 0
        ? `Remuxing audio for browser playback · ${elapsed}`
        : detail.replace('encoded', 'remuxed')
    } else if (status === 'Starting') {
      detail = segmentCount === 0
        ? `Starting direct stream · ${elapsed}`
        : `Stream ready · ${elapsed}`
    } else if (isTranscoding) {
      if (stalled) {
        detail = segmentCount === 0
          ? `Still waiting for first segment · ${elapsed}`
          : `No new segments recently · ${elapsed}`
      } else if (segmentCount === 0) {
        detail = progress?.active
          ? `Starting encoder · ${elapsed}`
          : `Preparing transcoder · ${elapsed}`
      } else if (duration && duration > 0) {
        const percent = Math.min(99, Math.round((transcodedSeconds / duration) * 100))
        progressValue = percent / 100
        detail = `${percent}% encoded · ${formatClock(transcodedSeconds)} of ${formatClock(duration)}`
      } else {
        progressValue = Math.min(0.9, segmentCount / 30)
        detail = `${segmentCount} segment${segmentCount === 1 ? '' : 's'} · ~${formatClock(transcodedSeconds)} encoded`
      }

      if (progress?.playlistReady && segmentCount > 0) {
        detail = `${detail} · almost ready`
      }
    }

    return {
      whimsical,
      detail,
      progress: progressValue,
      stalled,
    }
  }, [elapsedMs, isTranscoding, mediaInfo?.duration, progress, status, whimsicalIndex])
}
