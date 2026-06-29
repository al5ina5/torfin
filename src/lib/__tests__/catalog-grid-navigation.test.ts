import { describe, expect, it } from 'vitest'

import { clusterCatalogRows, findSpatialCatalogNeighbor } from '../catalog-grid-navigation'

function rect(index: number, left: number, top: number, width: number, height: number) {
  return {
    index,
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  }
}

describe('clusterCatalogRows', () => {
  it('groups items with uneven heights in the same row', () => {
    const rows = clusterCatalogRows([
      rect(0, 0, 0, 100, 140),
      rect(1, 120, 0, 100, 180),
      rect(2, 240, 0, 100, 150),
      rect(3, 360, 0, 100, 140),
      rect(4, 480, 0, 100, 135),
      rect(5, 600, 0, 100, 145),
      rect(6, 720, 0, 100, 150),
      rect(7, 0, 200, 100, 150),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]!.map((item) => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(rows[1]!.map((item) => item.index)).toEqual([7])
  })
})

describe('findSpatialCatalogNeighbor', () => {
  const grid7 = [
    rect(0, 0, 0, 100, 150),
    rect(1, 120, 0, 100, 150),
    rect(2, 240, 0, 100, 150),
    rect(3, 360, 0, 100, 150),
    rect(4, 480, 0, 100, 150),
    rect(5, 600, 0, 100, 150),
    rect(6, 720, 0, 100, 150),
    rect(7, 0, 170, 100, 150),
    rect(8, 120, 170, 100, 150),
    rect(9, 240, 170, 100, 150),
    rect(10, 360, 170, 100, 150),
    rect(11, 480, 170, 100, 150),
  ]

  it('moves straight down in a 7-column grid', () => {
    expect(findSpatialCatalogNeighbor(grid7, 0, 'down')).toBe(7)
    expect(findSpatialCatalogNeighbor(grid7, 3, 'down')).toBe(10)
  })

  it('does not jump to index 3 when pressing down from index 0', () => {
    expect(findSpatialCatalogNeighbor(grid7, 0, 'down')).not.toBe(3)
  })

  it('moves straight up in a grid', () => {
    expect(findSpatialCatalogNeighbor(grid7, 10, 'up')).toBe(3)
    expect(findSpatialCatalogNeighbor(grid7, 7, 'up')).toBe(0)
  })

  it('moves left and right within a row', () => {
    expect(findSpatialCatalogNeighbor(grid7, 3, 'left')).toBe(2)
    expect(findSpatialCatalogNeighbor(grid7, 3, 'right')).toBe(4)
  })

  it('moves down in a single-column list', () => {
    const list = [
      rect(0, 0, 0, 300, 48),
      rect(1, 0, 56, 300, 48),
      rect(2, 0, 112, 300, 48),
    ]

    expect(findSpatialCatalogNeighbor(list, 0, 'down')).toBe(1)
    expect(findSpatialCatalogNeighbor(list, 1, 'up')).toBe(0)
  })

  it('moves down in a multi-column list', () => {
    const list = [
      rect(0, 0, 0, 180, 48),
      rect(1, 188, 0, 180, 48),
      rect(2, 0, 56, 180, 48),
      rect(3, 188, 56, 180, 48),
    ]

    expect(findSpatialCatalogNeighbor(list, 0, 'down')).toBe(2)
    expect(findSpatialCatalogNeighbor(list, 1, 'down')).toBe(3)
  })

  it('stays put when there is no neighbor', () => {
    expect(findSpatialCatalogNeighbor(grid7, 0, 'up')).toBe(0)
    expect(findSpatialCatalogNeighbor(grid7, 6, 'right')).toBe(6)
    expect(findSpatialCatalogNeighbor(grid7, 11, 'down')).toBe(11)
  })
})
