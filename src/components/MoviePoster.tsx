import { useCallback, useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'

type MoviePosterProps = {
  src?: string
  className?: string
  iconSize?: number
  priority?: boolean
}

function markLoaded(img: HTMLImageElement | null, onReady: () => void) {
  if (img?.complete && img.naturalWidth > 0) {
    onReady()
  }
}

export function MoviePoster({ src, className = '', iconSize = 20, priority = false }: MoviePosterProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const markReady = useCallback(() => setLoaded(true), [])

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    markLoaded(imgRef.current, markReady)
  }, [src, markReady])

  const handleRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node
      markLoaded(node, markReady)
    },
    [markReady],
  )

  if (!src || failed) {
    return (
      <div className={`grid h-full place-items-center bg-[var(--mac-control)] text-[var(--mac-tertiary)] ${className}`}>
        <Star size={iconSize} />
      </div>
    )
  }

  return (
    <>
      <div
        className={`absolute inset-0 bg-[var(--mac-control)] transition-opacity duration-150 ${
          loaded ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-hidden
      />
      <img
        ref={handleRef}
        src={src}
        alt=""
        className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${
          loaded ? 'movie-poster-reveal' : 'opacity-0'
        } ${className}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={markReady}
        onError={() => setFailed(true)}
      />
    </>
  )
}
