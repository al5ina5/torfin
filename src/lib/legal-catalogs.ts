import type { Movie } from '../types'

export const LEGAL_CATALOG_BASE = 'https://caching.stremio.net'

export const legalCatalogOptions = [
  {
    id: 'publicDomain' as const,
    group: 'Free & Legal',
    label: 'Public Domain',
    shortLabel: 'PD',
  },
  {
    id: 'creativeCommons' as const,
    group: 'Free & Legal',
    label: 'Creative Commons',
    shortLabel: 'CC',
  },
] as const

export type LegalCatalogId = (typeof legalCatalogOptions)[number]['id']

export const LEGAL_CATALOG_REMOTE_URLS = {
  publicDomain: `${LEGAL_CATALOG_BASE}/catalog/movie/publicdomainmovies.json`,
} as const

export const LEGAL_CATALOG_URLS: Record<LegalCatalogId, string | null> = {
  publicDomain: LEGAL_CATALOG_REMOTE_URLS.publicDomain,
  creativeCommons: null,
}

const creativeCommonsMovies: Movie[] = [
  {
    id: 'tt1254207',
    type: 'movie',
    name: 'Big Buck Bunny',
    releaseInfo: '2008',
    runtime: '10 min',
    imdbRating: '6.4',
    genres: ['Animation', 'Comedy', 'Family'],
    description: 'A giant rabbit with a heart bigger than himself takes on three bullies who harass the woodland creatures.',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTU0Njg2NzkwM15BMl5BanBnXkFtZTcwNjA0OTY5Mw@@._V1_SX300.jpg',
  },
  {
    id: 'tt0879986',
    type: 'movie',
    name: "Elephants Dream",
    releaseInfo: '2006',
    runtime: '11 min',
    imdbRating: '5.7',
    genres: ['Animation', 'Short'],
    description: 'Two strange characters explore a capricious and seemingly infinite machine in this open-source Blender short.',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTI0NTI0NDI5M15BMl5BanBnXkFtZTcwNDI0NDI5MQ@@._V1_SX300.jpg',
  },
  {
    id: 'tt1166827',
    type: 'movie',
    name: 'Sita Sings the Blues',
    releaseInfo: '2008',
    runtime: '82 min',
    imdbRating: '7.6',
    genres: ['Animation', 'Comedy', 'Drama'],
    description: 'An animated retelling of the Ramayana set to 1920s jazz vocals, released under Creative Commons.',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTQ2NDI3NDA2N15BMl5BanBnXkFtZTcwNDI3NDA2Mw@@._V1_SX300.jpg',
  },
  {
    id: 'tt2290553',
    type: 'movie',
    name: 'Tears of Steel',
    releaseInfo: '2012',
    runtime: '12 min',
    imdbRating: '5.6',
    genres: ['Sci-Fi', 'Short'],
    description: 'A Blender Foundation sci-fi short about a group trying to save a woman from a destructive robot.',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTU0Njg2NzkwM15BMl5BanBnXkFtZTcwNjA0OTY5Mw@@._V1_SX300.jpg',
  },
  {
    id: 'tt4687090',
    type: 'movie',
    name: 'Cosmos Laundromat',
    releaseInfo: '2015',
    runtime: '12 min',
    imdbRating: '6.5',
    genres: ['Animation', 'Comedy', 'Fantasy'],
    description: 'A sheep named Franck gets a second chance at life in this open Blender Foundation pilot.',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTU0Njg2NzkwM15BMl5BanBnXkFtZTcwNjA0OTY5Mw@@._V1_SX300.jpg',
  },
  {
    id: 'tt0017136',
    type: 'movie',
    name: 'Metropolis',
    releaseInfo: '1927',
    runtime: '153 min',
    imdbRating: '8.3',
    genres: ['Drama', 'Sci-Fi'],
    description: 'A classic silent sci-fi epic now in the public domain in many jurisdictions.',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTg1MzAyNDUzM15BMl5BanBnXkFtZTcwNjA1MDUzMw@@._V1_SX300.jpg',
  },
  {
    id: 'tt0012349',
    type: 'movie',
    name: 'The Kid',
    releaseInfo: '1921',
    runtime: '68 min',
    imdbRating: '8.3',
    genres: ['Comedy', 'Drama', 'Family'],
    description: 'Charlie Chaplin cares for an abandoned child in this silent comedy classic.',
    poster: 'https://m.media-amazon.com/images/M/MV5BZjhhMThhNDItNTY2MC00MmU1LTliNDEtNDdhZjdlNTY5ZDQ1XkEyXkFqcGdeQXVyNjc1NTYyMjg@._V1_SX300.jpg',
  },
  {
    id: 'tt0024216',
    type: 'movie',
    name: 'Nosferatu',
    releaseInfo: '1922',
    runtime: '94 min',
    imdbRating: '7.9',
    genres: ['Fantasy', 'Horror'],
    description: 'F.W. Murnau\'s unauthorized Dracula adaptation, now widely available as public-domain media.',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTI2NTI2NDI5M15BMl5BanBnXkFtZTcwNDI0NDI5MQ@@._V1_SX300.jpg',
  },
]

export function isLegalCatalog(catalogId: string): catalogId is LegalCatalogId {
  return legalCatalogOptions.some((option) => option.id === catalogId)
}

export function isEmbeddedLegalCatalog(catalogId: string) {
  return catalogId === 'creativeCommons'
}

export function embeddedLegalCatalogMovies(catalogId: string): Movie[] {
  if (catalogId === 'creativeCommons') return creativeCommonsMovies
  return []
}

export function legalCatalogUrl(catalogId: string) {
  if (!isLegalCatalog(catalogId)) return null
  return LEGAL_CATALOG_URLS[catalogId]
}
