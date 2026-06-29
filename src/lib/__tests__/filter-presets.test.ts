import { describe, expect, it } from 'vitest'

import {
  FEATURED_PRESET_COUNT,
  allFilterPresets,
  builtInFilterPresets,
  createFilterPreset,
  findFilterPresetByRouteSlug,
  pickFeaturedPresets,
  presetRouteSlug,
} from '../filter-presets'
import { defaultMovieFilters } from '../movies'

describe('filter presets', () => {
  it('includes built-in presets with stable ids', () => {
    expect(builtInFilterPresets.length).toBeGreaterThan(20)
    expect(builtInFilterPresets.every((p) => p.id.startsWith('builtin-'))).toBe(true)
    expect(builtInFilterPresets.every((p) => p.builtIn)).toBe(true)
  })

  it('pickFeaturedPresets returns requested count', () => {
    const featured = pickFeaturedPresets(builtInFilterPresets, 3)
    expect(featured).toHaveLength(3)
    expect(new Set(featured.map((p) => p.id)).size).toBe(3)
  })

  it('pickFeaturedPresets caps at available presets', () => {
    const featured = pickFeaturedPresets(builtInFilterPresets, 999)
    expect(featured.length).toBeLessThanOrEqual(builtInFilterPresets.length)
  })

  it('defaults featured count to FEATURED_PRESET_COUNT', () => {
    const featured = pickFeaturedPresets(builtInFilterPresets)
    expect(featured).toHaveLength(FEATURED_PRESET_COUNT)
  })

  it('allFilterPresets merges built-in and custom', () => {
    const all = allFilterPresets()
    expect(all.length).toBeGreaterThanOrEqual(builtInFilterPresets.length)
    expect(all[0].id).toMatch(/^builtin-/)
  })

  it('maps built-in presets to stable route slugs', () => {
    const horror = builtInFilterPresets.find((preset) => preset.id === 'builtin-top-horror')!
    expect(presetRouteSlug(horror)).toBe('top-horror')
    expect(findFilterPresetByRouteSlug('top-horror')).toMatchObject({ id: 'builtin-top-horror' })
  })

  it('createFilterPreset trims name and marks custom', () => {
    const preset = createFilterPreset('  My Filters  ', defaultMovieFilters)
    expect(preset.name).toBe('My Filters')
    expect(preset.builtIn).toBe(false)
    expect(preset.id).toMatch(/^custom-/)
    expect(preset.slug).toMatch(/^my-filters-/)
  })

  it('createFilterPreset uses fallback name when empty', () => {
    expect(createFilterPreset('   ', defaultMovieFilters).name).toBe('Custom preset')
  })
})
