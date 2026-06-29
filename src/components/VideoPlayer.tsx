import { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

import { insertAirPlayButton, registerAirPlayButton } from '../lib/videoPlayerAirPlay'
import { insertTrackMenuButton, registerTrackMenuButton, syncTrackMenu } from '../lib/videoPlayerTracks'
import { isTranscodePlaybackUrl, resolvePlaybackUrl, seekHlsTranscode, transcodeSessionId } from '../lib/playback'
import type { MediaInfo } from '../types'

type VideoPlayerProps = {
  url: string
  title: string
  autoPlay?: boolean
  startAt?: number | null
  knownDuration?: number | null
  mediaOffset?: number | null
  onMediaOffsetChange?: (offset: number) => void
  mediaInfo: MediaInfo | null
  selectedAudioIndex: number | null
  selectedSubtitleIndex: number | null
  onSelectAudio: (value: string) => void
  onSelectSubtitle: (value: string) => void
  onError?: () => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
}

const SEEK_DEBOUNCE_MS = 450
const SEEK_MIN_SERVER_DELTA_SECS = 4

function sourceType(url: string) {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  })()
  if (path.endsWith('.m3u8')) return 'application/x-mpegURL'
  if (path.endsWith('.mpd')) return 'application/dash+xml'
  if (path.endsWith('.mp4') || path.endsWith('.m4v')) return 'video/mp4'
  if (path.endsWith('.webm')) return 'video/webm'
  if (path.endsWith('.ogv') || path.endsWith('.ogg')) return 'video/ogg'
  return undefined
}

function destroyPlayer(player: ReturnType<typeof videojs>, host: HTMLDivElement | null) {
  try {
    player.pause()
    const video = player.el()?.querySelector('video')
    if (video instanceof HTMLVideoElement) {
      video.muted = true
      video.pause()
      video.removeAttribute('src')
      video.srcObject = null
      video.load()
    }
    player.dispose()
  } catch {
    // Player may already be disposed.
  }
  host?.replaceChildren()
}

function swapTranscodeSource(player: ReturnType<typeof videojs>, nextUrl: string) {
  player.pause()
  const video = player.el()?.querySelector('video')
  if (video instanceof HTMLVideoElement) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }

  player.src({ src: nextUrl, type: 'application/x-mpegURL' })
}

function disableLiveMode(player: ReturnType<typeof videojs>) {
  player.removeClass('vjs-live')
  player.removeClass('vjs-liveui')
  const liveTracker = (player as { liveTracker?: { stopTracking(): void } }).liveTracker
  liveTracker?.stopTracking()
}

function getVideoElement(player: ReturnType<typeof videojs>) {
  const el = player.el()?.querySelector('video')
  return el instanceof HTMLVideoElement ? el : null
}

function isTimeBuffered(video: HTMLVideoElement, time: number) {
  for (let index = 0; index < video.buffered.length; index += 1) {
    if (time >= video.buffered.start(index) - 0.25 && time <= video.buffered.end(index) - 0.35) {
      return true
    }
  }
  return false
}

type TimelineState = {
  nativeCurrentTime: (time?: number) => number | undefined
  seekLock: boolean
  sessionUrl: string
  seekDebounceTimer: ReturnType<typeof setTimeout> | null
  pendingSeekTarget: number | null
}

function installAbsoluteTimeline(
  player: ReturnType<typeof videojs>,
  options: {
    url: string
    knownDuration: number | null | undefined
    mediaOffsetRef: { current: number }
    onMediaOffsetChange?: (offset: number) => void
    onSeekingChange?: (seeking: boolean) => void
  },
) {
  const { url, knownDuration, mediaOffsetRef, onMediaOffsetChange, onSeekingChange } = options
  const transcode = isTranscodePlaybackUrl(url)
  if (!transcode && !knownDuration) return

  const playerState = player as ReturnType<typeof videojs> & { torfinTimeline?: TimelineState }
  if (!playerState.torfinTimeline) {
    playerState.torfinTimeline = {
      nativeCurrentTime: player.currentTime.bind(player),
      seekLock: false,
      sessionUrl: url,
      seekDebounceTimer: null,
      pendingSeekTarget: null,
    }
  }

  const state = playerState.torfinTimeline
  state.sessionUrl = url

  const setMediaOffset = (offset: number) => {
    mediaOffsetRef.current = offset
    onMediaOffsetChange?.(offset)
  }

  const executeServerSeek = (absoluteTarget: number) => {
    const sessionId = transcodeSessionId(state.sessionUrl)
    if (!sessionId || state.seekLock) return

    state.seekLock = true
    onSeekingChange?.(true)
    const shouldResume = player.scrubbing() || !player.paused()
    player.pause()

    void seekHlsTranscode(sessionId, absoluteTarget)
      .then((result) => {
        setMediaOffset(result.mediaOffset ?? absoluteTarget)
        const nextUrl = `${resolvePlaybackUrl(result.url)}?seek=${Date.now()}`
        state.sessionUrl = nextUrl
        swapTranscodeSource(player, nextUrl)
        player.one('loadedmetadata', () => {
          state.nativeCurrentTime(0)
          state.seekLock = false
          onSeekingChange?.(false)
          if (shouldResume) {
            void player.play()
          }
        })
      })
      .catch(() => {
        state.seekLock = false
        onSeekingChange?.(false)
        if (shouldResume) {
          void player.play()
        }
      })
  }

  const scheduleServerSeek = (absoluteTarget: number) => {
    state.pendingSeekTarget = absoluteTarget
    if (state.seekDebounceTimer) {
      clearTimeout(state.seekDebounceTimer)
    }
    state.seekDebounceTimer = setTimeout(() => {
      state.seekDebounceTimer = null
      const target = state.pendingSeekTarget
      state.pendingSeekTarget = null
      if (target === null) return
      executeServerSeek(target)
    }, SEEK_DEBOUNCE_MS)
  }

  player.currentTime = function currentTime(time?: number) {
    if (time === undefined) {
      const local = state.nativeCurrentTime() ?? 0
      if (!Number.isFinite(local)) return local
      return local + mediaOffsetRef.current
    }

    const absoluteTarget = knownDuration && knownDuration > 0
      ? Math.max(0, Math.min(time, knownDuration - 0.1))
      : Math.max(0, time)

    if (!transcode) {
      state.nativeCurrentTime(absoluteTarget)
      return
    }

    const currentAbsolute = (state.nativeCurrentTime() ?? 0) + mediaOffsetRef.current
    const delta = Math.abs(absoluteTarget - currentAbsolute)
    const localTarget = absoluteTarget - mediaOffsetRef.current
    const video = getVideoElement(player)

    if (delta < 0.35) return

    if (delta < SEEK_MIN_SERVER_DELTA_SECS && video && isTimeBuffered(video, localTarget)) {
      state.nativeCurrentTime(localTarget)
      return
    }

    if (player.scrubbing()) {
      scheduleServerSeek(absoluteTarget)
      return
    }

    if (delta < SEEK_MIN_SERVER_DELTA_SECS) {
      state.nativeCurrentTime(localTarget)
      return
    }

    scheduleServerSeek(absoluteTarget)
  }
}

function applyKnownDuration(player: ReturnType<typeof videojs>, knownDuration: number | null | undefined) {
  if (!knownDuration || knownDuration <= 0) return

  disableLiveMode(player)

  const playerState = player as ReturnType<typeof videojs> & {
    torfinNativeDuration?: (seconds?: number) => number | undefined
  }
  const nativeDuration = playerState.torfinNativeDuration ?? player.duration.bind(player)
  playerState.torfinNativeDuration = nativeDuration

  player.duration = function duration(value?: number) {
    if (value !== undefined) {
      return nativeDuration(value)
    }
    const reported = nativeDuration()
    if (reported === undefined || !Number.isFinite(reported) || reported === Infinity || reported <= 0) {
      return knownDuration
    }
    return reported
  }
}

function buildPlayerOptions(autoPlay: boolean, url: string) {
  const type = sourceType(url)
  return {
    autoplay: autoPlay,
    controls: true,
    fill: true,
    fluid: false,
    liveui: false,
    responsive: false,
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
    controlBar: {
      skipButtons: {
        forward: 10,
        backward: 10,
      },
    },
    html5: {
      vhs: {
        overrideNative: !videojs.browser.IS_ANY_SAFARI,
        allowSeeksWithinUnsafeLiveWindow: true,
        smoothQualityChange: true,
        enableLowInitialPlaylist: true,
        bandwidth: 8_000_000,
      },
    },
    liveTracker: {
      trackingThreshold: Number.POSITIVE_INFINITY,
    },
    sources: [type ? { src: url, type } : { src: url }],
  }
}

function applyStartAt(player: ReturnType<typeof videojs>, startAt: number | null) {
  if (!startAt || startAt <= 0) return

  const seek = () => {
    const duration = player.duration()
    const target = typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? Math.min(startAt, Math.max(duration - 0.25, 0))
      : startAt
    player.currentTime(target)
  }

  if (player.readyState() >= 1) {
    seek()
    return
  }

  player.one('canplay', seek)
}

registerAirPlayButton()
registerTrackMenuButton()

export function VideoPlayer({
  url,
  title,
  autoPlay = true,
  startAt = null,
  knownDuration = null,
  mediaOffset = null,
  onMediaOffsetChange,
  mediaInfo,
  selectedAudioIndex,
  selectedSubtitleIndex,
  onSelectAudio,
  onSelectSubtitle,
  onError,
  onTimeUpdate,
  onEnded,
}: VideoPlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null)
  const ignoreErrorsRef = useRef(false)
  const onErrorRef = useRef(onError)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onEndedRef = useRef(onEnded)
  const onMediaOffsetChangeRef = useRef(onMediaOffsetChange)
  const onSelectAudioRef = useRef(onSelectAudio)
  const onSelectSubtitleRef = useRef(onSelectSubtitle)
  const durationRef = useRef(knownDuration ?? mediaInfo?.duration ?? null)
  const mediaOffsetRef = useRef(mediaOffset ?? 0)
  const [buffering, setBuffering] = useState(false)
  const [serverSeeking, setServerSeeking] = useState(false)

  onErrorRef.current = onError
  onTimeUpdateRef.current = onTimeUpdate
  onEndedRef.current = onEnded
  onMediaOffsetChangeRef.current = onMediaOffsetChange
  onSelectAudioRef.current = onSelectAudio
  onSelectSubtitleRef.current = onSelectSubtitle
  durationRef.current = knownDuration ?? mediaInfo?.duration ?? null
  if (mediaOffset !== null && mediaOffset !== undefined) {
    mediaOffsetRef.current = mediaOffset
  }

  useEffect(() => {
    if (!url || !hostRef.current) return
    ignoreErrorsRef.current = false
    setBuffering(false)
    setServerSeeking(false)

    const host = hostRef.current
    host.replaceChildren()

    const videoElement = document.createElement('video-js')
    videoElement.classList.add('video-js', 'vjs-big-play-centered', 'movie-player-video')
    videoElement.setAttribute('playsinline', 'true')
    videoElement.setAttribute('preload', 'auto')
    videoElement.setAttribute('x-webkit-airplay', 'allow')
    host.append(videoElement)

    const player = videojs(videoElement, buildPlayerOptions(autoPlay, url)) as ReturnType<typeof videojs> & {
      torfinOnSelectAudio?: (value: string) => void
      torfinOnSelectSubtitle?: (value: string) => void
    }
    player.torfinOnSelectAudio = (value: string) => onSelectAudioRef.current(value)
    player.torfinOnSelectSubtitle = (value: string) => onSelectSubtitleRef.current(value)
    playerRef.current = player

    const handleError = () => {
      if (ignoreErrorsRef.current) return
      const delay = url.includes('.m3u8') ? 5000 : 250
      window.setTimeout(() => {
        if (ignoreErrorsRef.current) return
        if (player.error()) onErrorRef.current?.()
      }, delay)
    }
    const handleTimeUpdate = () => {
      const current = player.currentTime()
      const duration = player.duration()
      if (typeof current === 'number' && typeof duration === 'number' && Number.isFinite(current) && Number.isFinite(duration) && duration > 0) {
        onTimeUpdateRef.current?.(current, duration)
      }
    }
    const handleEnded = () => onEndedRef.current?.()
    const handleWaiting = () => setBuffering(true)
    const handlePlaying = () => setBuffering(false)
    const handleCanPlay = () => setBuffering(false)

    player.on('error', handleError)
    player.on('timeupdate', handleTimeUpdate)
    player.on('ended', handleEnded)
    player.on('waiting', handleWaiting)
    player.on('playing', handlePlaying)
    player.on('canplay', handleCanPlay)
    player.ready(() => {
      const el = player.el().querySelector('video')
      if (el instanceof HTMLVideoElement) {
        el.setAttribute('x-webkit-airplay', 'allow')
        el.setAttribute('webkit-playsinline', 'true')
      }
      insertAirPlayButton(player)
      insertTrackMenuButton(player)
      syncTrackMenu(player, mediaInfo, selectedAudioIndex, selectedSubtitleIndex)
      applyKnownDuration(player, durationRef.current)
      installAbsoluteTimeline(player, {
        url,
        knownDuration: durationRef.current,
        mediaOffsetRef,
        onMediaOffsetChange: (offset) => onMediaOffsetChangeRef.current?.(offset),
        onSeekingChange: setServerSeeking,
      })
      if (!isTranscodePlaybackUrl(url)) {
        applyStartAt(player, startAt)
      }
    })

    const handleDurationChange = () => {
      applyKnownDuration(player, durationRef.current)
    }
    player.on('durationchange', handleDurationChange)
    player.on('loadedmetadata', handleDurationChange)

    return () => {
      ignoreErrorsRef.current = true
      const timeline = (player as ReturnType<typeof videojs> & { torfinTimeline?: TimelineState }).torfinTimeline
      if (timeline?.seekDebounceTimer) {
        clearTimeout(timeline.seekDebounceTimer)
      }
      player.off('error', handleError)
      player.off('timeupdate', handleTimeUpdate)
      player.off('ended', handleEnded)
      player.off('waiting', handleWaiting)
      player.off('playing', handlePlaying)
      player.off('canplay', handleCanPlay)
      player.off('durationchange', handleDurationChange)
      player.off('loadedmetadata', handleDurationChange)
      destroyPlayer(player, host)
      if (playerRef.current === player) playerRef.current = null
    }
  }, [autoPlay, url])

  useEffect(() => {
    durationRef.current = knownDuration ?? mediaInfo?.duration ?? null
    if (mediaOffset !== null && mediaOffset !== undefined) {
      mediaOffsetRef.current = mediaOffset
    }

    const player = playerRef.current
    if (!player || player.isDisposed()) return

    syncTrackMenu(player, mediaInfo, selectedAudioIndex, selectedSubtitleIndex)
    applyKnownDuration(player, durationRef.current)
    installAbsoluteTimeline(player, {
      url,
      knownDuration: durationRef.current,
      mediaOffsetRef,
      onMediaOffsetChange: (offset) => onMediaOffsetChangeRef.current?.(offset),
      onSeekingChange: setServerSeeking,
    })
  }, [knownDuration, mediaInfo, mediaOffset, selectedAudioIndex, selectedSubtitleIndex, url])

  if (!url) return null

  const hasTracks = Boolean(mediaInfo?.audioTracks.length || mediaInfo?.subtitleTracks.length)

  return (
    <section className="movie-player block overflow-hidden bg-black text-white">
      <div className="movie-player-stage">
        <div className="movie-player-titlebar">
          <span className="movie-player-title">{title}</span>
          {hasTracks ? (
            <div className="movie-player-titlebar-tracks lg:hidden">
              {mediaInfo?.audioTracks.length ? (
                <select
                  value={selectedAudioIndex ?? ''}
                  onChange={(event) => onSelectAudio(event.target.value)}
                  className="movie-player-titlebar-select"
                  aria-label="Audio track"
                >
                  {mediaInfo.audioTracks.map((track) => (
                    <option key={track.index} value={track.index}>
                      {track.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {mediaInfo?.subtitleTracks.length ? (
                <select
                  value={selectedSubtitleIndex ?? ''}
                  onChange={(event) => onSelectSubtitle(event.target.value)}
                  className="movie-player-titlebar-select"
                  aria-label="Subtitles"
                >
                  <option value="">Off</option>
                  {mediaInfo.subtitleTracks.map((track) => (
                    <option key={track.index} value={track.index}>
                      {track.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}
        </div>
        <div ref={hostRef} className="movie-player-video-host aspect-video w-full" />
        {buffering || serverSeeking ? (
          <div className="movie-player-buffering" aria-hidden="true">
            <div className="movie-player-buffering-spinner" />
            <span>{serverSeeking ? 'Seeking…' : 'Buffering…'}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
