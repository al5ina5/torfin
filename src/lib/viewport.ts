function isStandaloneWebApp(): boolean {
  return (
    // iOS Safari — most reliable signal for home-screen PWAs.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  )
}

function readSafeAreaInsets() {
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:constant(safe-area-inset-top)',
    'padding-top:env(safe-area-inset-top)',
    'padding-right:constant(safe-area-inset-right)',
    'padding-right:env(safe-area-inset-right)',
    'padding-bottom:constant(safe-area-inset-bottom)',
    'padding-bottom:env(safe-area-inset-bottom)',
    'padding-left:constant(safe-area-inset-left)',
    'padding-left:env(safe-area-inset-left)',
  ].join(';')
  document.documentElement.appendChild(probe)
  const styles = getComputedStyle(probe)
  const insets = {
    top: parseFloat(styles.paddingTop) || 0,
    right: parseFloat(styles.paddingRight) || 0,
    bottom: parseFloat(styles.paddingBottom) || 0,
    left: parseFloat(styles.paddingLeft) || 0,
  }
  probe.remove()
  return insets
}

function syncSafeAreaInsets() {
  if (!isStandaloneWebApp()) {
    document.documentElement.style.removeProperty('--app-safe-top')
    document.documentElement.style.removeProperty('--app-safe-right')
    document.documentElement.style.removeProperty('--app-safe-left')
    document.documentElement.style.removeProperty('--app-home-indicator')
    return
  }

  const { top, right, bottom, left } = readSafeAreaInsets()
  const root = document.documentElement.style
  root.setProperty('--app-safe-top', `${top}px`)
  root.setProperty('--app-safe-right', `${right}px`)
  root.setProperty('--app-safe-left', `${left}px`)
  root.setProperty('--app-home-indicator', `${bottom}px`)
}

function syncViewportHeight() {
  const standalone = isStandaloneWebApp()
  document.documentElement.dataset.standalone = standalone ? 'true' : 'false'

  // In iOS standalone, 100dvh / innerHeight exclude safe-area-inset-top and
  // leave a gap at the bottom. 100vh matches the full screen in that mode.
  document.documentElement.style.setProperty(
    '--app-viewport-height',
    standalone ? '100vh' : '100dvh',
  )

  syncSafeAreaInsets()
}

export function initViewportHeight() {
  syncViewportHeight()
  requestAnimationFrame(syncSafeAreaInsets)
  window.addEventListener('resize', syncViewportHeight, { passive: true })
  window.addEventListener('orientationchange', syncViewportHeight, { passive: true })
  window.addEventListener('focus', syncViewportHeight, { passive: true })
}
