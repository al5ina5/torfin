import { toast as sonnerToast, type ExternalToast } from 'sonner'

type ToastOptions = ExternalToast

const defaultDurations = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
} as const

export const toast = {
  success(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.success(title, {
      description,
      duration: options?.duration ?? defaultDurations.success,
      ...options,
    })
  },
  error(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.error(title, {
      description,
      duration: options?.duration ?? defaultDurations.error,
      ...options,
    })
  },
  warning(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.warning(title, {
      description,
      duration: options?.duration ?? defaultDurations.warning,
      ...options,
    })
  },
  info(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.info(title, {
      description,
      duration: options?.duration ?? defaultDurations.info,
      ...options,
    })
  },
  message(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast(title, {
      description,
      duration: options?.duration ?? defaultDurations.info,
      ...options,
    })
  },
  dismiss(id?: string | number) {
    sonnerToast.dismiss(id)
  },
}
