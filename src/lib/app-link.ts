import type { MouseEvent } from 'react'

/** True for a plain left-click without modifier keys (SPA navigation candidate). */
export function isPlainLeftClick(event: MouseEvent<HTMLElement>) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

/** Intercept plain left-clicks for client-side routing; let modified clicks open natively. */
export function handleAppLinkClick(event: MouseEvent<HTMLAnchorElement>, onNavigate: () => void) {
  if (!isPlainLeftClick(event)) return
  event.preventDefault()
  onNavigate()
}
