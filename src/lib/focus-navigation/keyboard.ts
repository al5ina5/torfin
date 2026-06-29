import { OVERLAY_CLOSE_SELECTORS } from './focusables'
import { findBlockingOverlayZone, getFocusZoneRoot } from './zones'
import { isElementVisible } from './visibility'

/** Click the standard close/cancel control on the topmost overlay, if present. */
export function tryDismissTopOverlay(isDesktop: boolean): boolean {
  const zone = findBlockingOverlayZone(isDesktop)
  if (!zone) return false

  const root = getFocusZoneRoot(zone)
  if (!root) return false

  for (const selector of OVERLAY_CLOSE_SELECTORS.split(', ')) {
    const button = root.querySelector<HTMLElement>(selector)
    if (button && isElementVisible(button)) {
      button.click()
      return true
    }
  }

  return false
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

export const directionByKey = {
  ArrowRight: 'right',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
} as const

export type DirectionKey = keyof typeof directionByKey
