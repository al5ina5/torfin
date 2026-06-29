export const filterGenres = [
  'Action',
  'Adventure',
  'Animation',
  'Biography',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'Film-Noir',
  'History',
  'Horror',
  'Music',
  'Musical',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Sport',
  'Thriller',
  'War',
  'Western',
] as const

export type GenreLabel = (typeof filterGenres)[number]

const genreCatalogIdOverrides: Partial<Record<GenreLabel, string>> = {
  'Sci-Fi': 'sciFi',
}

export function genreToCatalogId(label: GenreLabel | string) {
  if (label in genreCatalogIdOverrides) {
    return genreCatalogIdOverrides[label as GenreLabel]!
  }

  return label
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
}

export const genreCatalogOptions = filterGenres.map((label) => ({
  id: genreToCatalogId(label),
  group: 'Genres' as const,
  label,
  shortLabel: label,
}))
