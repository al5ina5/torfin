import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

import { insertAirPlayButton, registerAirPlayButton } from '../lib/videoPlayerAirPlay'
import type { MediaInfo } from '../types'

type VideoPlayerProps = {
  url: string
  title: string
  autoPlay?: boolean
  startAt?: number | null
  mediaInfo: MediaInfo | null
  selectedAudioIndex: number | null
  selectedSubtitleIndex: number | null
  onSelectAudio: (value: string) => void
  onSelectSubtitle: (value: string) => void
  onError?: () => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
}

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

function buildPlayerOptions(autoPlay: boolean, url: string) {
  const type = sourceType(url)
  const isHls = type === 'application/x-mpegURL'
  return {
    autoplay: autoPlay,
    controls: true,
    fill: true,
    fluid: false,
    liveui: isHls,
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
      },
    },
    liveTracker: {
      trackingThreshold: 0,
      liveTolerance: 20,
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

export function VideoPlayer({
  url,
  title,
  autoPlay = true,
  startAt = null,
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

  onErrorRef.current = onError
  onTimeUpdateRef.current = onTimeUpdate
  onEndedRef.current = onEnded

  useEffect(() => {
    if (!url || !hostRef.current) return
    ignoreErrorsRef.current = false

    const host = hostRef.current
    host.replaceChildren()

    const videoElement = document.createElement('video-js')
    videoElement.classList.add('video-js', 'vjs-big-play-centered', 'movie-player-video')
    videoElement.setAttribute('playsinline', 'true')
    videoElement.setAttribute('preload', 'auto')
    videoElement.setAttribute('x-webkit-airplay', 'allow')
    host.append(videoElement)

    const player = videojs(videoElement, buildPlayerOptions(autoPlay, url))
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

    player.on('error', handleError)
    player.on('timeupdate', handleTimeUpdate)
    player.on('ended', handleEnded)
    player.ready(() => {
      const el = player.el().querySelector('video')
      if (el instanceof HTMLVideoElement) {
        el.setAttribute('x-webkit-airplay', 'allow')
        el.setAttribute('webkit-playsinline', 'true')
      }
      insertAirPlayButton(player)
      applyStartAt(player, startAt)
    })

    return () => {
      ignoreErrorsRef.current = true
      player.off('error', handleError)
      player.off('timeupdate', handleTimeUpdate)
      player.off('ended', handleEnded)
      destroyPlayer(player, host)
      if (playerRef.current === player) playerRef.current = null
    }
  }, [autoPlay, startAt, url])

  if (!url) return null

  return (
    <section className="movie-player block overflow-hidden bg-black text-white">
      <div className="movie-player-stage">
        <div className="movie-player-titlebar">
          <span className="movie-player-title">{title}</span>
        </div>
        <div ref={hostRef} className="movie-player-video-host aspect-video w-full" />
      </div>
      {mediaInfo?.audioTracks.length || mediaInfo?.subtitleTracks.length ? (
        <div className="movie-player-trackbar">
          {mediaInfo?.audioTracks.length ? (
            <label className="movie-player-field">
              <span>Audio</span>
              <select
                value={selectedAudioIndex ?? ''}
                onChange={(event) => onSelectAudio(event.target.value)}
                className="movie-player-select"
                title="Audio track"
              >
                {mediaInfo.audioTracks.map((track) => (
                  <option key={track.index} value={track.index} className="bg-[#18181b]">
                    {track.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mediaInfo?.subtitleTracks.length ? (
            <label className="movie-player-field">
              <span>Subtitles</span>
              <select
                value={selectedSubtitleIndex ?? ''}
                onChange={(event) => onSelectSubtitle(event.target.value)}
                className="movie-player-select"
                title="Subtitles"
              >
                <option value="" className="bg-[#18181b]">
                  Off
                </option>
                {mediaInfo.subtitleTracks.map((track) => (
                  <option key={track.index} value={track.index} className="bg-[#18181b]">
                    {track.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
