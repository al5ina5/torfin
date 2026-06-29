function isStandaloneWebApp(): boolean {
  return (
    // iOS Safari — most reliable signal for home-screen PWAs.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  )
}

function syncViewportHeight() {
  // In iOS standalone, 100dvh / innerHeight exclude safe-area-inset-top and
  // leave a gap at the bottom. 100vh matches the full screen in that mode.
  document.documentElement.style.setProperty(
    '--app-viewport-height',
    isStandaloneWebApp() ? '100vh' : '100dvh',
  )
}

export function initViewportHeight() {
  syncViewportHeight()
  window.addEventListener('resize', syncViewportHeight, { passive: true })
  window.addEventListener('orientationchange', syncViewportHeight, { passive: true })
  window.addEventListener('focus', syncViewportHeight, { passive: true })
}
