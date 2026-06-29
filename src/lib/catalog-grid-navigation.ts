type ItemRect = {
  index: number
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
}

export type CatalogNavigationDirection = 'up' | 'down' | 'left' | 'right'

const ROW_TOLERANCE_PX = 8
const CATALOG_GRID_SELECTOR = '.catalog-grid'
const CATALOG_ITEM_SELECTOR = '.movie-item-enter'

function getCatalogGridContainer(scrollContainer: HTMLElement | null): HTMLElement | null {
  if (!scrollContainer) return null
  return scrollContainer.querySelector<HTMLElement>(CATALOG_GRID_SELECTOR)
}

function getCatalogItemElements(scrollContainer: HTMLElement | null): HTMLElement[] {
  if (!scrollContainer) return []
  return Array.from(scrollContainer.querySelectorAll<HTMLElement>(CATALOG_ITEM_SELECTOR))
}

function readCatalogIndex(element: HTMLElement, fallback: number) {
  const layoutIndex = Number(element.dataset.catalogIndex)
  return Number.isFinite(layoutIndex) ? layoutIndex : fallback
}

function getItemRects(items: HTMLElement[], grid: HTMLElement): ItemRect[] {
  const gridRect = grid.getBoundingClientRect()

  return items.map((element, index) => {
    const rect = element.getBoundingClientRect()
    const left = rect.left - gridRect.left
    const top = rect.top - gridRect.top
    const width = rect.width
    const height = rect.height

    return {
      index: readCatalogIndex(element, index),
      left,
      right: left + width,
      top,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    }
  })
}

export function clusterCatalogRows(items: ItemRect[]): ItemRect[][] {
  const rows: ItemRect[][] = []

  for (const item of items) {
    const row = rows.find((entry) => Math.abs(entry[0]!.top - item.top) <= ROW_TOLERANCE_PX)
    if (row) row.push(item)
    else rows.push([item])
  }

  return rows.map((row) => row.sort((a, b) => a.left - b.left))
}

function findRowColumn(rows: ItemRect[][], index: number) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const columnIndex = rows[rowIndex]!.findIndex((item) => item.index === index)
    if (columnIndex >= 0) return { rowIndex, columnIndex }
  }

  const flat = rows.flat()
  if (!flat.length) return { rowIndex: 0, columnIndex: 0 }

  const closest = flat.reduce((best, item) =>
    Math.abs(item.index - index) < Math.abs(best.index - index) ? item : best,
  )
  return findRowColumn(rows, closest.index)
}

export function findSpatialCatalogNeighbor(
  items: ItemRect[],
  currentIndex: number,
  direction: CatalogNavigationDirection,
): number {
  if (!items.length) return currentIndex

  const knownIndexes = items.map((item) => item.index)
  const maxIndex = Math.max(...knownIndexes)
  const safeIndex = knownIndexes.includes(currentIndex)
    ? currentIndex
    : knownIndexes.reduce((best, index) =>
        Math.abs(index - currentIndex) < Math.abs(best - currentIndex) ? index : best,
      )

  const rows = clusterCatalogRows(items)
  const { rowIndex, columnIndex } = findRowColumn(rows, safeIndex)
  const currentRow = rows[rowIndex]!

  switch (direction) {
    case 'right': {
      if (columnIndex + 1 >= currentRow.length) return safeIndex
      return currentRow[columnIndex + 1]!.index
    }
    case 'left': {
      if (columnIndex <= 0) return safeIndex
      return currentRow[columnIndex - 1]!.index
    }
    case 'down': {
      if (rowIndex + 1 >= rows.length) return safeIndex
      const nextRow = rows[rowIndex + 1]!
      return nextRow[Math.min(columnIndex, nextRow.length - 1)]!.index
    }
    case 'up': {
      if (rowIndex <= 0) return safeIndex
      const previousRow = rows[rowIndex - 1]!
      return previousRow[Math.min(columnIndex, previousRow.length - 1)]!.index
    }
  }
}

export function resolveCatalogNavigationIndex(
  scrollContainer: HTMLElement | null,
  currentIndex: number,
  direction: CatalogNavigationDirection,
  itemCount: number,
): number {
  if (itemCount <= 0) return -1

  const grid = getCatalogGridContainer(scrollContainer)
  const items = getCatalogItemElements(scrollContainer)
  if (grid && items.length) {
    return findSpatialCatalogNeighbor(getItemRects(items, grid), currentIndex, direction)
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), itemCount - 1)
  switch (direction) {
    case 'right':
      return Math.min(itemCount - 1, safeIndex + 1)
    case 'left':
      return Math.max(0, safeIndex - 1)
    case 'down':
      return Math.min(itemCount - 1, safeIndex + 1)
    case 'up':
      return Math.max(0, safeIndex - 1)
  }
}

export function scrollCatalogItemIntoView(scrollContainer: HTMLElement | null, index: number) {
  const item = getCatalogItemElements(scrollContainer).find(
    (element) => readCatalogIndex(element, -1) === index,
  )
  item?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
