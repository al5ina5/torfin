import type { ExternalLink, Movie } from '../types'

function uniqueNames(...lists: Array<string[] | undefined>) {
  const seen = new Set<string>()
  const names: string[] = []
  for (const list of lists) {
    for (const name of list ?? []) {
      const trimmed = name.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      names.push(trimmed)
    }
  }
  return names
}

export function mergeCreditNames(...lists: Array<string[] | undefined>) {
  return uniqueNames(...lists)
}

export function buildExternalLinks(movie: Movie): ExternalLink[] {
  const links: ExternalLink[] = []
  const isSeries = movie.type === 'series'
  const searchName = encodeURIComponent(movie.name)

  if (movie.imdbUrl || movie.id.startsWith('tt')) {
    links.push({
      id: 'imdb',
      label: 'IMDb',
      shortLabel: 'IMDb',
      url: movie.imdbUrl ?? `https://www.imdb.com/title/${movie.id}/`,
      tone: 'imdb',
    })
  }

  if (movie.movieDbId) {
    links.push({
      id: 'tmdb',
      label: 'The Movie Database',
      shortLabel: 'TMDB',
      url: isSeries
        ? `https://www.themoviedb.org/tv/${movie.movieDbId}`
        : `https://www.themoviedb.org/movie/${movie.movieDbId}`,
      tone: 'tmdb',
    })
  }

  if (movie.tvdbId && isSeries) {
    links.push({
      id: 'tvdb',
      label: 'TheTVDB',
      shortLabel: 'TVDB',
      url: `https://www.thetvdb.com/?tab=series&id=${movie.tvdbId}`,
      tone: 'tvdb',
    })
  }

  if (movie.id.startsWith('tt')) {
    if (!isSeries) {
      links.push({
        id: 'letterboxd',
        label: 'Letterboxd',
        shortLabel: 'Letterboxd',
        url: `https://letterboxd.com/imdb/${movie.id}/`,
        tone: 'letterboxd',
      })
    }
    links.push({
      id: 'trakt',
      label: 'Trakt',
      shortLabel: 'Trakt',
      url: `https://trakt.tv/search?search=${encodeURIComponent(movie.id)}`,
      tone: 'trakt',
    })
  }

  links.push({
    id: 'rottentomatoes',
    label: 'Rotten Tomatoes',
    shortLabel: 'Rotten Tomatoes',
    url: `https://www.rottentomatoes.com/search?search=${searchName}`,
  })
  links.push({
    id: 'metacritic',
    label: 'Metacritic',
    shortLabel: 'Metacritic',
    url: `https://www.metacritic.com/search/${searchName}/`,
  })
  links.push({
    id: 'wikipedia',
    label: 'Wikipedia',
    shortLabel: 'Wikipedia',
    url: `https://en.wikipedia.org/wiki/Special:Search?search=${searchName}`,
    tone: 'wiki',
  })
  links.push({
    id: 'justwatch',
    label: 'JustWatch',
    shortLabel: 'JustWatch',
    url: `https://www.justwatch.com/us/search?q=${searchName}`,
  })

  if (movie.shareUrl) {
    links.push({
      id: 'stremio',
      label: 'Stremio',
      shortLabel: 'Stremio',
      url: movie.shareUrl,
    })
  }

  return links
}
