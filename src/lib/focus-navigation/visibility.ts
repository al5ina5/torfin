export function isElementVisible(element: HTMLElement) {
  if (!element.isConnected) return false
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function overlayZIndex(element: HTMLElement): number {
  let current: HTMLElement | null = element
  let highest = 0
  while (current) {
    const parsed = Number.parseInt(window.getComputedStyle(current).zIndex, 10)
    if (Number.isFinite(parsed)) highest = Math.max(highest, parsed)
    current = current.parentElement
  }
  return highest
}
