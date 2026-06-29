type MovieGridSkeletonProps = {
  posterSize: number
  count?: number
}

export function MovieGridSkeleton({ posterSize, count = 14 }: MovieGridSkeletonProps) {
  return (
    <div
      className="grid gap-x-4 gap-y-5"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${posterSize}px, 1fr))` }}
      aria-busy
      aria-label="Loading titles"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="movie-skeleton-enter min-w-0"
          style={{ animationDelay: `${Math.min(index, 20) * 20}ms` }}
        >
          <div className="movie-poster-skeleton aspect-[2/3] rounded-lg" />
          <div className="mt-2 space-y-1.5 px-1">
            <div className="movie-poster-skeleton h-3.5 w-[88%] rounded" />
            <div className="movie-poster-skeleton h-3 w-[42%] rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
