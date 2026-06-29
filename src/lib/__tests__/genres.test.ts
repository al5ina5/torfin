import { describe, expect, it } from 'vitest'

import { filterGenres, genreCatalogOptions, genreToCatalogId, topGenres } from '../genres'

describe('genreToCatalogId', () => {
  it('maps sci-fi to camelCase id', () => {
    expect(genreToCatalogId('Sci-Fi')).toBe('sciFi')
  })

  it('lowercases simple genres', () => {
    expect(genreToCatalogId('Action')).toBe('action')
    expect(genreToCatalogId('Film-Noir')).toBe('filmNoir')
  })
})

describe('genre catalog options', () => {
  it('covers all filter genres', () => {
    expect(genreCatalogOptions).toHaveLength(filterGenres.length)
    expect(genreCatalogOptions.every((o) => o.group === 'Genres')).toBe(true)
  })

  it('top genres are subset of filter genres', () => {
    for (const genre of topGenres) {
      expect(filterGenres).toContain(genre)
    }
  })
})
