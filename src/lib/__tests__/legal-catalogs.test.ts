import { describe, expect, it } from 'vitest'

import {
  embeddedLegalCatalogMovies,
  isEmbeddedLegalCatalog,
  isLegalCatalog,
  LEGAL_CATALOG_REMOTE_URLS,
  legalCatalogOptions,
} from '../legal-catalogs'
import { catalogUrlMap, isLocalCatalog } from '../movies'

describe('legal catalogs', () => {
  it('defines sidebar options in the Free & Legal group', () => {
    expect(legalCatalogOptions.map((option) => option.group)).toEqual(['Free & Legal', 'Free & Legal'])
    expect(legalCatalogOptions.map((option) => option.id)).toEqual(['publicDomain', 'creativeCommons'])
  })

  it('maps public domain to the Stremio addon catalog', () => {
    expect(LEGAL_CATALOG_REMOTE_URLS.publicDomain).toBe(
      'https://caching.stremio.net/catalog/movie/publicdomainmovies.json',
    )
    expect(catalogUrlMap('movie').publicDomain).toBe(LEGAL_CATALOG_REMOTE_URLS.publicDomain)
  })

  it('treats embedded legal catalogs as local-only', () => {
    expect(isLegalCatalog('publicDomain')).toBe(true)
    expect(isLegalCatalog('creativeCommons')).toBe(true)
    expect(isEmbeddedLegalCatalog('creativeCommons')).toBe(true)
    expect(isLocalCatalog('creativeCommons')).toBe(true)
    expect(isLocalCatalog('publicDomain')).toBe(false)
  })

  it('ships curated Creative Commons titles with IMDB ids', () => {
    const movies = embeddedLegalCatalogMovies('creativeCommons')
    expect(movies.length).toBeGreaterThan(4)
    expect(movies.every((movie) => movie.id.startsWith('tt'))).toBe(true)
  })
})
