import { useEffect } from 'react'
import { Toaster } from 'sonner'

import { useMediaQuery } from '../hooks/useMediaQuery'
import { useResolvedTheme } from '../hooks/useResolvedTheme'
import { installAppToastStyles } from '../lib/install-app-toast-styles'
import {
  APP_TOAST_BASE_OPTIONS,
  APP_TOAST_CLASS_NAMES,
  appToasterStyle,
} from '../lib/toast-config'

export function AppToaster() {
  const theme = useResolvedTheme()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const toastWidth = isDesktop
    ? 'min(480px, calc(100vw - 48px))'
    : 'min(420px, calc(100vw - 24px))'

  useEffect(() => {
    installAppToastStyles()
  }, [])

  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      richColors={false}
      expand
      closeButton
      visibleToasts={isDesktop ? 5 : 3}
      gap={8}
      offset={isDesktop ? 20 : 12}
      style={appToasterStyle(toastWidth)}
      toastOptions={{
        ...APP_TOAST_BASE_OPTIONS,
        classNames: APP_TOAST_CLASS_NAMES,
      }}
    />
  )
}
