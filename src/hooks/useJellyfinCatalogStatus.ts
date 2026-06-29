import { useEffect, useMemo, useRef, useState } from 'react'

import { batchLookupJellyfinLibrary, jellyfinLibraryKey } from '../lib/jellyfin-library'
import type { JellyfinLibraryMatch, Movie } from '../types'

type UseJellyfinCatalogStatusArgs = {
  enabled: boolean
  movies: Movie[]
  jellyfinUrl: string
  jellyfinApiKey: string
}

export function useJellyfinCatalogStatus({
  enabled,
  movies,
  jellyfinUrl,
  jellyfinApiKey,
}: UseJellyfinCatalogStatusArgs) {
  const [matches, setMatches] = useState<Record<string, JellyfinLibraryMatch | null>>({})
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef(matches)

  const movieKeys = useMemo(
    () => movies.map((movie) => jellyfinLibraryKey(movie.type, movie.id)).join('|'),
    [movies],
  )

  useEffect(() => {
    cacheRef.current = matches
  }, [matches])

  useEffect(() => {
    if (!enabled || !jellyfinUrl.trim() || !jellyfinApiKey.trim() || !movies.length) {
      setMatches({})
      setLoading(false)
      return
    }

    let cancelled = false
    const pending = movies
      .map((movie) => {
        const key = jellyfinLibraryKey(movie.type, movie.id)
        if (cacheRef.current[key]) return null
        return { key, imdbId: movie.id, contentType: movie.type }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

    if (!pending.length) return

    setLoading(true)
    void batchLookupJellyfinLibrary({
      baseUrl: jellyfinUrl,
      apiKey: jellyfinApiKey,
      items: pending,
    })
      .then((next) => {
        if (cancelled) return
        setMatches((current) => ({ ...current, ...next }))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, jellyfinApiKey, jellyfinUrl, movieKeys, movies])

  return { libraryMatches: matches, libraryMatchesLoading: loading }
}
