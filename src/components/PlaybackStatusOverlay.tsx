import { Loader2 } from 'lucide-react'

import { usePlaybackStatusProgress } from '../hooks/usePlaybackStatusProgress'
import type { MediaInfo } from '../types'

type PlaybackStatusOverlayProps = {
  status: string
  mediaInfo: MediaInfo | null
}

export function PlaybackStatusOverlay({ status, mediaInfo }: PlaybackStatusOverlayProps) {
  const { detail, whimsical, progress, stalled } = usePlaybackStatusProgress(status, mediaInfo)

  return (
    <div className="grid aspect-video w-full place-items-center bg-black text-white">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 px-6">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Loader2 className="animate-spin" size={16} />
          {status}
        </div>

        <div className="w-full space-y-2">
          {progress !== null ? (
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${stalled ? 'bg-amber-400/80' : 'bg-white/70'}`}
                style={{ width: `${Math.max(progress * 100, stalled ? 8 : 4)}%` }}
              />
            </div>
          ) : (
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div className="playback-status-indeterminate h-full w-1/3 rounded-full bg-white/50" />
            </div>
          )}

          <div className="space-y-1 text-center">
            <p className={`text-[11px] leading-relaxed ${stalled ? 'text-amber-200/80' : 'text-white/55'}`}>
              {detail}
            </p>
            <p className="text-[10px] leading-relaxed text-white/30">
              {whimsical}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
