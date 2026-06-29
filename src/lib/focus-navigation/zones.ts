import {
  findSpatialCatalogNeighbor,
} from '../catalog-grid-navigation'
import { FOCUSABLE_SELECTOR } from './focusables'
import { FOCUS_ZONE_ATTR, KIOSK_FOCUS_CLASS, type FocusZone, type NavigationDirection } from './types'
import { isElementVisible, overlayZIndex } from './visibility'

type ItemRect = {
  index: number
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
}

export function getFocusZoneRoot(zone: FocusZone): HTMLElement | null {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(`[${FOCUS_ZONE_ATTR}="${zone}"]`))
  return roots.find((root) => isElementVisible(root)) ?? null
}

export function getFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (!isElementVisible(element)) return false
    if (element.closest('[aria-hidden="true"]')) return false
    if (element.closest('[inert]')) return false
    return true
  })
}

export function getFocusablesInZone(zone: FocusZone): HTMLElement[] {
  const root = getFocusZoneRoot(zone)
  return root ? getFocusables(root) : []
}

function elementRects(elements: HTMLElement[], container: HTMLElement): ItemRect[] {
  const containerRect = container.getBoundingClientRect()

  return elements.map((element, index) => {
    const rect = element.getBoundingClientRect()
    const left = rect.left - containerRect.left
    const top = rect.top - containerRect.top
    const width = rect.width
    const height = rect.height

    return {
      index,
      left,
      right: left + width,
      top,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    }
  })
}

export function findSpatialFocusNeighbor(
  elements: HTMLElement[],
  container: HTMLElement,
  current: HTMLElement | null,
  direction: NavigationDirection,
): HTMLElement | null {
  if (!elements.length) return null

  const currentIndex = current ? elements.indexOf(current) : -1
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const rects = elementRects(elements, container)
  const nextIndex = findSpatialCatalogNeighbor(rects, safeIndex, direction)
  if (nextIndex === safeIndex) return null
  return elements[nextIndex] ?? null
}

export function clearKioskFocus() {
  document.querySelectorAll(`.${KIOSK_FOCUS_CLASS}`).forEach((element) => {
    element.classList.remove(KIOSK_FOCUS_CLASS)
  })
}

export function setKioskFocus(element: HTMLElement | null) {
  clearKioskFocus()
  if (!element) return
  element.classList.add(KIOSK_FOCUS_CLASS)
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

export function getKioskFocused(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.${KIOSK_FOCUS_CLASS}`)
}

export function activateKioskFocused(): boolean {
  const focused = getKioskFocused()
  if (!focused) return false
  focused.click()
  return true
}

export function getKioskFocusAnchorY(): number | null {
  const focused = getKioskFocused()
  if (!focused) return null
  const rect = focused.getBoundingClientRect()
  return rect.top + rect.height / 2
}

export function getCatalogItemAnchorY(scrollContainer: HTMLElement | null, catalogIndex: number): number | null {
  if (!scrollContainer || catalogIndex < 0) return null

  const items = Array.from(scrollContainer.querySelectorAll<HTMLElement>('.movie-item-enter'))
  const item =
    items.find((element) => Number(element.dataset.catalogIndex) === catalogIndex) ?? items[catalogIndex]
  if (!item) return null

  const rect = item.getBoundingClientRect()
  return rect.top + rect.height / 2
}

export function findNearestFocusableByViewportY(elements: HTMLElement[], anchorY: number): HTMLElement | null {
  if (!elements.length) return null

  let best = elements[0]!
  let bestDistance = Infinity

  for (const element of elements) {
    const rect = element.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    const distance = Math.abs(centerY - anchorY)
    if (distance < bestDistance) {
      bestDistance = distance
      best = element
    }
  }

  return best
}

export function findNearestCatalogIndex(scrollContainer: HTMLElement | null, anchorY: number): number | null {
  const items = Array.from(scrollContainer?.querySelectorAll<HTMLElement>('.movie-item-enter') ?? [])
  if (!items.length) return null

  let bestIndex: number | null = null
  let bestDistance = Infinity

  for (const [fallbackIndex, item] of items.entries()) {
    const rect = item.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    const distance = Math.abs(centerY - anchorY)
    const layoutIndex = Number(item.dataset.catalogIndex)
    const index = Number.isFinite(layoutIndex) ? layoutIndex : fallbackIndex
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  return bestIndex
}

export function focusNearestInZone(zone: FocusZone, anchorY: number | null, preferred?: HTMLElement | null) {
  const root = getFocusZoneRoot(zone)
  if (!root) return
  const focusables = getFocusables(root)
  if (!focusables.length) return

  const target =
    preferred && focusables.includes(preferred)
      ? preferred
      : anchorY === null
        ? focusables.find((element) => element.getAttribute('aria-current') === 'true') ??
          focusables.find((element) => element.getAttribute('aria-selected') === 'true') ??
          focusables.find((element) => element.classList.contains('is-active-focus')) ??
          focusables[0]!
        : findNearestFocusableByViewportY(focusables, anchorY) ?? focusables[0]!

  setKioskFocus(target)
}

export function focusFirstInZone(zone: FocusZone, preferred?: HTMLElement | null) {
  focusNearestInZone(zone, null, preferred)
}

export function navigateZoneFocus(
  zone: FocusZone,
  direction: NavigationDirection,
  current: HTMLElement | null,
): HTMLElement | null {
  const root = getFocusZoneRoot(zone)
  if (!root) return null
  const focusables = getFocusables(root)
  return findSpatialFocusNeighbor(focusables, root, current, direction)
}

export function isCatalogAtHorizontalEdge(
  scrollContainer: HTMLElement | null,
  currentIndex: number,
  direction: 'left' | 'right',
  itemCount: number,
): boolean {
  if (!scrollContainer || itemCount <= 0) return direction === 'left'

  const grid = scrollContainer.querySelector<HTMLElement>('.catalog-grid')
  const items = Array.from(scrollContainer.querySelectorAll<HTMLElement>('.movie-item-enter'))
  if (!grid || !items.length) {
    return direction === 'left' ? currentIndex <= 0 : currentIndex >= itemCount - 1
  }

  const containerRect = grid.getBoundingClientRect()
  const rects = items.map((element, index) => {
    const rect = element.getBoundingClientRect()
    const left = rect.left - containerRect.left
    const top = rect.top - containerRect.top
    const width = rect.width
    const height = rect.height
    const layoutIndex = Number(element.dataset.catalogIndex)
    return {
      index: Number.isFinite(layoutIndex) ? layoutIndex : index,
      left,
      right: left + width,
      top,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    }
  })

  const neighbor = findSpatialCatalogNeighbor(rects, currentIndex, direction)
  return neighbor === currentIndex
}

function isOpenMobileDrawer(element: HTMLElement) {
  const sheet = element.classList.contains('app-drawer-sheet') ? element : element.closest('.app-drawer-sheet')
  return Boolean(sheet?.classList.contains('is-open') && isElementVisible(sheet as HTMLElement))
}

function isBlockingModalRoot(element: HTMLElement) {
  if (!isElementVisible(element)) return false
  if (element.closest('.app-modal-backdrop')) return true
  if (element.getAttribute('role') === 'alertdialog') return true
  if (element.classList.contains('app-confirm-sheet') && element.classList.contains('is-open')) return true
  if (
    element.classList.contains('app-drawer-sheet') &&
    element.classList.contains('is-open') &&
    element.getAttribute(FOCUS_ZONE_ATTR) === 'modal'
  ) {
    return true
  }
  return false
}

function overlayWeight(zone: FocusZone, element: HTMLElement, isDesktop: boolean) {
  const z = overlayZIndex(element)
  if (zone === 'modal') return z + 1000
  if (!isDesktop && zone === 'sidebar') return z + 100
  if (!isDesktop && zone === 'inspector') return z + 50
  return -1
}

/** Detect the topmost blocking overlay from live DOM — no manual modal flags needed. */
export function findBlockingOverlayZone(isDesktop: boolean): FocusZone | null {
  const candidates: Array<{ zone: FocusZone; weight: number }> = []

  document.querySelectorAll<HTMLElement>(`[${FOCUS_ZONE_ATTR}]`).forEach((element) => {
    const zone = element.getAttribute(FOCUS_ZONE_ATTR) as FocusZone | null
    if (!zone) return

    if (zone === 'modal' && isBlockingModalRoot(element)) {
      candidates.push({ zone, weight: overlayWeight(zone, element, isDesktop) })
      return
    }

    if (!isDesktop && (zone === 'sidebar' || zone === 'inspector') && isOpenMobileDrawer(element)) {
      candidates.push({ zone, weight: overlayWeight(zone, element, isDesktop) })
    }
  })

  candidates.sort((left, right) => right.weight - left.weight)
  return candidates[0]?.zone ?? null
}

export function isInspectorZoneNavigable() {
  return getFocusablesInZone('inspector').length > 0
}

export function isBodyOverlayActive(isDesktop: boolean) {
  return Boolean(findBlockingOverlayZone(isDesktop))
}
