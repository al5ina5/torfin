import { youtubeTrailerEmbedUrl, youtubeVideoIdFromUrl } from '../lib/cinemeta'

type TrailerEmbedProps = {
  trailerUrl: string
  title: string
}

export function TrailerEmbed({ trailerUrl, title }: TrailerEmbedProps) {
  const videoId = youtubeVideoIdFromUrl(trailerUrl)
  if (!videoId) return null

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--mac-border)] bg-black">
      <div className="relative aspect-video">
        <iframe
          src={youtubeTrailerEmbedUrl(videoId)}
          title={`${title} trailer`}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  )
}
