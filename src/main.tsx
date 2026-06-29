import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SWRConfig } from 'swr'
import './index.css'
import { initTheme } from './lib/theme'
import App from './App.tsx'

initTheme()

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
    </SWRConfig>
  </StrictMode>,
)
