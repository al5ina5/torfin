import { describe, expect, it } from 'vitest'

import { buildExternalLinks, mergeCreditNames } from '../external-links'
import type { Movie } from '../../types'

const baseMovie: Movie = {
  id: 'tt1375666',
  type: 'movie',
  name: 'Inception',
  releaseInfo: '2010',
  movieDbId: 27205,
  imdbUrl: 'https://www.imdb.com/title/tt1375666/',
  shareUrl: 'https://www.strem.io/s/movie/inception-1375666',
}

describe('buildExternalLinks', () => {
  it('includes direct service links for movies', () => {
    const links = buildExternalLinks(baseMovie)
    const ids = links.map((link) => link.id)

    expect(ids).toContain('imdb')
    expect(ids).toContain('tmdb')
    expect(ids).toContain('letterboxd')
    expect(ids).toContain('trakt')
    expect(ids).toContain('stremio')
    expect(links.find((link) => link.id === 'tmdb')?.url).toBe('https://www.themoviedb.org/movie/27205')
    expect(links.find((link) => link.id === 'letterboxd')?.url).toBe('https://letterboxd.com/imdb/tt1375666/')
  })

  it('includes tvdb for series when available', () => {
    const links = buildExternalLinks({
      ...baseMovie,
      id: 'tt0944947',
      type: 'series',
      name: 'Game of Thrones',
      tvdbId: 121361,
      movieDbId: 1399,
    })

    expect(links.find((link) => link.id === 'tvdb')?.url).toBe('https://www.thetvdb.com/?tab=series&id=121361')
    expect(links.find((link) => link.id === 'tmdb')?.url).toBe('https://www.themoviedb.org/tv/1399')
    expect(links.some((link) => link.id === 'letterboxd')).toBe(false)
  })
})

describe('mergeCreditNames', () => {
  it('deduplicates names case-insensitively while preserving order', () => {
    expect(mergeCreditNames(['Leonardo DiCaprio'], ['leonardo dicaprio', 'Joseph Gordon-Levitt'])).toEqual([
      'Leonardo DiCaprio',
      'Joseph Gordon-Levitt',
    ])
  })
})
