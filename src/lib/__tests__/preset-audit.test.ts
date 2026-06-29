import { describe, expect, it } from 'vitest'

import { catalogPageUrl, catalogSupportsPagination, CINEMETA_CATALOG_URLS, normalizeCatalogItem } from '../cinemeta'
import { builtInFilterPresets } from '../filter-presets'
import { catalogUrlWithFilters, clientFiltersForCatalog, filterAndSortMovies, movieYear } from '../movies'
import type { Movie } from '../../types'

const MIN_GOOD = 20

async function fetchPage(url: string, skip = 0) {
  const res = await fetch(catalogPageUrl(url, skip))
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const body = (await res.json()) as { metas?: unknown[] }
  return (body.metas || [])
    .map((item) => normalizeCatalogItem(item as never, 'movie'))
    .filter(Boolean) as Movie[]
}

async function auditPreset(name: string, filters: (typeof builtInFilterPresets)[number]['filters']) {
  const trending = CINEMETA_CATALOG_URLS.trending
  const url = catalogUrlWithFilters(trending, filters, 'movie', 'trending')
  const paginates = catalogSupportsPagination(url)
  let all = await fetchPage(url, 0)
  if (paginates) {
    for (let skip = all.length; skip < 1000 && all.length < 1000; skip += 100) {
      const page = await fetchPage(url, skip)
      if (!page.length) break
      const seen = new Set(all.map((movie) => movie.id))
      for (const movie of page) {
        if (!seen.has(movie.id)) all.push(movie)
      }
      if (page.length < 50) break
    }
  }
  return {
    url,
    paginates,
    raw: all.length,
    filtered: filterAndSortMovies(all, clientFiltersForCatalog(url, 'trending', filters)).length,
  }
}

describe('preset audit', () => {
  it('golden age options', async () => {
    const golden = builtInFilterPresets.find((p) => p.id === 'builtin-golden-age')!
    let top: Movie[] = []
    for (let skip = 0; skip < 1000; skip += 100) {
      const page = await fetchPage(CINEMETA_CATALOG_URLS.trending, skip)
      if (!page.length) break
      const seen = new Set(top.map((m) => m.id))
      for (const movie of page) if (!seen.has(movie.id)) top.push(movie)
    }
    console.log('golden from top', filterAndSortMovies(top, golden.filters).length)
    for (const year of [1955, 1960, 1965, 1975, 1982, 1985]) {
      const page = await fetchPage(`https://v3-cinemeta.strem.io/catalog/movie/year/genre=${year}.json`, 0)
      const seventies = builtInFilterPresets.find((p) => p.id === 'builtin-70s-cinema')!
      const cult = builtInFilterPresets.find((p) => p.id === 'builtin-cult-classics')!
      console.log('year', year, '70s', filterAndSortMovies(page, seventies.filters).length, 'cult', filterAndSortMovies(page, cult.filters).length)
    }
    const action80s = builtInFilterPresets.find((p) => p.id === 'builtin-80s-action')!
    console.log('80s no rating', filterAndSortMovies(top, { ...action80s.filters, minRating: '' }).length)
    console.log('80s rating 5', filterAndSortMovies(top, { ...action80s.filters, minRating: '5' }).length)
  }, 90_000)

  it('year catalog decade samples', async () => {
    const years = [1985, 1995, 2005, 2015]
    for (const year of years) {
      const url = `https://v3-cinemeta.strem.io/catalog/movie/year/genre=${year}.json`
      const all = await fetchPage(url, 0)
      console.log('year', year, 'count', all.length)
    }
    const action80s = builtInFilterPresets.find((p) => p.id === 'builtin-80s-action')!
    const y1985 = await fetchPage('https://v3-cinemeta.strem.io/catalog/movie/year/genre=1985.json', 0)
    console.log('1985 all min6', filterAndSortMovies(y1985, { apiCatalog:'', genre:'', releaseYear:'', yearFrom:'1980', yearTo:'1989', minRating:'6', sortBy:'ratingDesc' }).length)
    console.log('80s action from 1985 year catalog', filterAndSortMovies(y1985, action80s.filters).length)
    const nineties = builtInFilterPresets.find((p) => p.id === 'builtin-90s-classics')!
    const y1995 = await fetchPage('https://v3-cinemeta.strem.io/catalog/movie/year/genre=1995.json', 0)
    console.log('90s classics from 1995 year catalog', filterAndSortMovies(y1995, nineties.filters).length)
  }, 60_000)

  it('genre+year combos from top', async () => {
    const url = CINEMETA_CATALOG_URLS.trending
    let all: Movie[] = []
    for (let skip = 0; skip < 500; skip += 100) {
      const page = await fetchPage(url, skip)
      if (!page.length) break
      const seen = new Set(all.map((m) => m.id))
      for (const movie of page) if (!seen.has(movie.id)) all.push(movie)
    }
    const action80s = builtInFilterPresets.find((p) => p.id === 'builtin-80s-action')!
    const summer = builtInFilterPresets.find((p) => p.id === 'builtin-summer-blockbusters')!
    const classicComedy = builtInFilterPresets.find((p) => p.id === 'builtin-classic-comedy')!
    console.log('80s action from top', filterAndSortMovies(all, action80s.filters).length)
    console.log('summer blockbusters from top', filterAndSortMovies(all, summer.filters).length)
    console.log('classic comedy from top', filterAndSortMovies(all, classicComedy.filters).length)
  }, 60_000)

  it('top catalog years sample', async () => {
    const url = CINEMETA_CATALOG_URLS.trending
    let all: Movie[] = []
    for (let skip = 0; skip < 500; skip += 100) {
      const page = await fetchPage(url, skip)
      if (!page.length) break
      const seen = new Set(all.map((m) => m.id))
      for (const movie of page) if (!seen.has(movie.id)) all.push(movie)
    }
    const years = all.map((m) => movieYear(m)).filter((y) => Number.isFinite(y))
    console.log('top pages count', all.length, 'year range', Math.min(...years), Math.max(...years))
    const nineties = builtInFilterPresets.find((p) => p.id === 'builtin-90s-classics')!
    console.log('90s from top', filterAndSortMovies(all, nineties.filters).length)
    const modern = builtInFilterPresets.find((p) => p.id === 'builtin-modern-masterpieces')!
    console.log('modern from top', filterAndSortMovies(all, modern.filters).length)
    const acclaimed = builtInFilterPresets.find((p) => p.id === 'builtin-critically-acclaimed')!
    console.log('acclaimed from top', filterAndSortMovies(all, acclaimed.filters).length)
  }, 60_000)

  it('imdbRating years sample', async () => {
    const url = CINEMETA_CATALOG_URLS.topRated
    const all = await fetchPage(url, 0)
    const years = all.map((m) => movieYear(m)).filter((y) => Number.isFinite(y))
    console.log('imdbRating page0 count', all.length, 'year range', Math.min(...years), Math.max(...years))
    console.log(all.slice(0, 10).map((m) => ({ name: m.name, year: movieYear(m), rating: m.imdbRating, releaseInfo: m.releaseInfo })))
    const nineties = builtInFilterPresets.find((p) => p.id === 'builtin-90s-classics')!
    const filtered = filterAndSortMovies(all, nineties.filters)
    console.log('90s filtered from page0', filtered.length)
  }, 30_000)

  it('sample genre tags', async () => {
    const genres = ['Horror', 'Documentary', 'Film-Noir', 'Musical', 'Sport', 'Family']
    for (const genre of genres) {
      const url = `https://v3-cinemeta.strem.io/catalog/movie/top/genre=${encodeURIComponent(genre)}.json`
      const body = (await (await fetch(url)).json()) as { metas?: Array<{ genres?: string[]; genre?: string[]; name?: string; imdbRating?: string; releaseInfo?: string }> }
      const movies = body.metas ?? []
      console.log('\n', genre, 'catalog', movies.length)
      const sample = movies.slice(0, 3).map((m) => ({ name: m.name, genres: m.genres ?? m.genre, rating: m.imdbRating, year: m.releaseInfo }))
      console.log(sample)
    }
  }, 30_000)

  it('genre catalog sizes', async () => {
    for (const genre of ['Horror', 'Action', 'Documentary', 'Film-Noir', 'Musical', 'Drama']) {
      const url = `https://v3-cinemeta.strem.io/catalog/movie/top/genre=${encodeURIComponent(genre)}.json`
      const res = await fetch(url)
      const body = (await res.json()) as { metas?: unknown[] }
      console.log(genre, body.metas?.length ?? 0, res.status)
    }
  }, 30_000)

  it('AUDIT_PRESETS reports weak presets', async () => {
    const results: Array<{ name: string; filtered: number; raw: number; url: string; paginates: boolean }> = []
    for (const preset of builtInFilterPresets) {
      const result = await auditPreset(preset.name, preset.filters)
      results.push({ name: preset.name, ...result })
    }

    const bad = results.filter((result) => result.filtered < MIN_GOOD)
    console.log('\n=== WEAK PRESETS ===')
    for (const result of bad.sort((left, right) => left.filtered - right.filtered)) {
      console.log(`${result.filtered}\t${result.name}\t${result.url}`)
    }
    console.log(`\nWeak: ${bad.length}/${results.length}`)

    expect(bad, bad.map((result) => `${result.name}: ${result.filtered}`).join('\n')).toEqual([])
  }, 120_000)
})
