import { useMemo } from 'react'
import { MkvPlayer } from '@mkv-web-player/player'
import '@mkv-web-player/player/styles.css'

import { mkvPlayerServer } from '../lib/mkvPlayerServer'
import { resolvePlaybackUrl } from '../lib/playback'

type VideoPlayerProps = {
  url: string
  sourceUrl?: string
  title: string
  poster?: string
  autoPlay?: boolean
  startAt?: number | null
  storageKey?: string
  onError?: () => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
}

export function VideoPlayer({
  url,
  sourceUrl = '',
  title,
  poster,
  autoPlay = true,
  startAt = null,
  storageKey,
  onError,
  onTimeUpdate,
  onEnded,
}: VideoPlayerProps) {
  const src = resolvePlaybackUrl(url)
  const server = useMemo(
    () => mkvPlayerServer(sourceUrl || url, url),
    [sourceUrl, url],
  )
  const popout = useMemo(
    () => ({
      enabled: true,
      defaultOpen: true,
      initialPlacement: 'bottom-left' as const,
      persistKey: storageKey || 'torfin-player',
    }),
    [storageKey],
  )

  if (!url) return null

  return (
    <MkvPlayer
      key={src}
      src={src}
      title={title}
      poster={poster}
      loadingPreview={poster ? { src: poster, poster } : undefined}
      autoPlay={autoPlay}
      startAt={startAt}
      storageKey={storageKey}
      server={server}
      popout={popout}
      className="torfin-mkv-player"
      onError={() => onError?.()}
      onProgress={(state) => {
        if (state.duration > 0) {
          onTimeUpdate?.(state.currentTime, state.duration)
        }
      }}
      onEnded={() => onEnded?.()}
    />
  )
}
