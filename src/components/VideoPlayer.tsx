import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import { PictureInPicture2 } from 'lucide-react'

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
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const ignoreErrorsRef = useRef(false)

  useEffect(() => {
    if (!url || !hostRef.current) return
    ignoreErrorsRef.current = false

    const videoElement = document.createElement('video-js')
    videoElement.classList.add('video-js', 'vjs-big-play-centered', 'movie-player-video')
    videoElement.setAttribute('playsinline', 'true')
    videoElement.setAttribute('preload', 'auto')
    videoElement.setAttribute('x-webkit-airplay', 'allow')
    hostRef.current.append(videoElement)

    const type = sourceType(url)
    const player = videojs(videoElement, {
      autoplay: autoPlay,
      controls: true,
      fluid: true,
      liveui: false,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      responsive: true,
      sources: [type ? { src: url, type } : { src: url }],
    })
    playerRef.current = player
    const handleError = () => {
      if (ignoreErrorsRef.current) return
      onError?.()
    }
    const handleTimeUpdate = () => {
      const current = player.currentTime()
      const duration = player.duration()
      if (typeof current === 'number' && typeof duration === 'number' && Number.isFinite(current) && Number.isFinite(duration) && duration > 0) {
        onTimeUpdate?.(current, duration)
      }
    }
    const handleEnded = () => onEnded?.()
    player.on('error', handleError)
    player.on('timeupdate', handleTimeUpdate)
    player.on('ended', handleEnded)
    player.ready(() => {
      const el = player.el().querySelector('video')
      if (el instanceof HTMLVideoElement) videoElRef.current = el
      if (startAt && startAt > 0) player.currentTime(startAt)
    })

    return () => {
      ignoreErrorsRef.current = true
      player.off('error', handleError)
      player.off('timeupdate', handleTimeUpdate)
      player.off('ended', handleEnded)
      player.dispose()
      if (playerRef.current === player) playerRef.current = null
      videoElRef.current = null
    }
  }, [autoPlay, onEnded, onError, onTimeUpdate, startAt, url])

  async function enterPictureInPicture() {
    const video = videoElRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        return
      }
      if (video.requestPictureInPicture) await video.requestPictureInPicture()
    } catch {
      // PiP may be unavailable in this browser context.
    }
  }

  if (!url) return null

  return (
    <section className="movie-player block overflow-hidden bg-black text-white">
      <div className="movie-player-stage">
        <div className="movie-player-titlebar flex items-center justify-between gap-2 pr-2">
          <span className="truncate">{title}</span>
          <button
            type="button"
            onClick={() => { void enterPictureInPicture() }}
            className="grid size-7 shrink-0 place-items-center rounded-md border border-white/15 bg-white/10 transition hover:bg-white/20"
            title="Picture in Picture"
          >
            <PictureInPicture2 size={14} />
          </button>
        </div>
        <div ref={hostRef} className="movie-player-video-host aspect-video w-full bg-black" />
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
