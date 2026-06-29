import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { SWRConfig } from 'swr'
import './index.css'
import { initTheme } from './lib/theme'
import { initViewportHeight } from './lib/viewport'
import { installAppToastStyles } from './lib/install-app-toast-styles'
import { AppToaster } from './components/AppToaster'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import App from './App.tsx'
import { initClientErrorReporting } from './lib/error-reporting'

initTheme()
initViewportHeight()
installAppToastStyles()
initClientErrorReporting()

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  </StrictMode>,
)
