import { Toaster } from 'sonner'

import { useResolvedTheme } from '../hooks/useResolvedTheme'

export function AppToaster() {
  const theme = useResolvedTheme()

  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      expand
      closeButton
      visibleToasts={5}
      gap={10}
      offset={20}
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
