import { ExternalLink, MonitorPlay } from 'lucide-react'

type NativePlaybackBannerProps = {
  player: string
  title: string
  mode: 'external' | 'window'
  onPlayEmbedded: () => void
}

export function NativePlaybackBanner({ player, title, mode, onPlayEmbedded }: NativePlaybackBannerProps) {
  return (
    <div className="movie-player-native grid aspect-video w-full place-items-center bg-[#0a0a0b] px-6 text-white">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/6">
          {mode === 'window' ? <MonitorPlay size={26} /> : <ExternalLink size={26} />}
        </div>
        <div className="space-y-1.5">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">Playing in {player}</p>
          <p className="text-[12px] leading-relaxed text-white/55">{title}</p>
          <p className="text-[11px] leading-relaxed text-white/38">
            {mode === 'window'
              ? 'A native macOS player window is open with hardware decoding, AirPlay, and full subtitle support.'
              : 'The stream opened in your native player. Use the player window for tracks, subtitles, and AirPlay.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onPlayEmbedded}
          className="h-8 rounded-md border border-white/16 bg-white/8 px-3 text-[12px] font-semibold transition hover:bg-white/12"
        >
          Switch to in-app player
        </button>
      </div>
    </div>
  )
}
