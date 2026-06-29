import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { SWRConfig } from 'swr'
import './index.css'
import { initTheme } from './lib/theme'
import { AppToaster } from './components/AppToaster'
import App from './App.tsx'

initTheme()

function syncViewportHeight() {
  document.documentElement.style.setProperty('--app-viewport-height', `${window.innerHeight}px`)
}

syncViewportHeight()
window.addEventListener('resize', syncViewportHeight, { passive: true })
window.visualViewport?.addEventListener('resize', syncViewportHeight, { passive: true })

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SWRConfig
      value={{
        dedupingInterval: 60_000,
        errorRetryCount: 1,
        focusThrottleInterval: 30_000,
        keepPreviousData: true,
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      }}
    >
      <App />
      <AppToaster />
    </SWRConfig>
  </StrictMode>,
)
