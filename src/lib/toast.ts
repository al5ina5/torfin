import { toast as sonnerToast, type ExternalToast } from 'sonner'

import { appToastOptions } from './toast-config'

type ToastOptions = ExternalToast

const defaultDurations = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
} as const

export const toast = {
  success(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.success(title, appToastOptions({
      description,
      duration: options?.duration ?? defaultDurations.success,
      ...options,
    }))
  },
  error(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.error(title, appToastOptions({
      description,
      duration: options?.duration ?? defaultDurations.error,
      ...options,
    }))
  },
  warning(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.warning(title, appToastOptions({
      description,
      duration: options?.duration ?? defaultDurations.warning,
      ...options,
    }))
  },
  info(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast.info(title, appToastOptions({
      description,
      duration: options?.duration ?? defaultDurations.info,
      ...options,
    }))
  },
  message(title: string, description?: string, options?: ToastOptions) {
    return sonnerToast(title, appToastOptions({
      description,
      duration: options?.duration ?? defaultDurations.info,
      ...options,
    }))
  },
  dismiss(id?: string | number) {
    sonnerToast.dismiss(id)
  },
}
