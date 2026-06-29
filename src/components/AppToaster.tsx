import { Toaster } from 'sonner'

import { useMediaQuery } from '../hooks/useMediaQuery'
import { useResolvedTheme } from '../hooks/useResolvedTheme'

export function AppToaster() {
  const theme = useResolvedTheme()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return (
    <Toaster
      theme={theme}
      position={isDesktop ? 'bottom-center' : 'top-center'}
      expand
      closeButton
      visibleToasts={isDesktop ? 5 : 3}
      gap={10}
      offset={isDesktop ? 20 : 12}
      toastOptions={{
        classNames: {
          toast: 'app-toast',
          title: 'app-toast-title',
          description: 'app-toast-description',
          closeButton: 'app-toast-close',
          success: 'app-toast-success',
          error: 'app-toast-error',
          warning: 'app-toast-warning',
          info: 'app-toast-info',
        },
      }}
    />
  )
}
