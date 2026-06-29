import type { CSSProperties } from 'react'
import type { ExternalToast } from 'sonner'

/** Shared Sonner class names — every toast uses these via AppToaster and toast(). */
export const APP_TOAST_CLASS_NAMES = {
  toast: 'app-toast',
  title: 'app-toast-title',
  description: 'app-toast-description',
  closeButton: 'app-toast-close',
  success: 'app-toast-success',
  error: 'app-toast-error',
  warning: 'app-toast-warning',
  info: 'app-toast-info',
} as const

export const APP_TOAST_BASE_OPTIONS = {
  richColors: false,
  classNames: APP_TOAST_CLASS_NAMES,
} satisfies ExternalToast

export function appToastOptions(options?: ExternalToast): ExternalToast {
  return {
    ...APP_TOAST_BASE_OPTIONS,
    ...options,
    classNames: {
      ...APP_TOAST_CLASS_NAMES,
      ...options?.classNames,
    },
  }
}

export function appToasterStyle(width: string): CSSProperties {
  return {
    '--width': width,
    '--border-radius': '999px',
    '--toast-close-button-start': 'unset',
    '--toast-close-button-end': '12px',
    '--toast-close-button-transform': 'translateY(-50%)',
    '--toast-icon-margin-start': '0',
    '--toast-icon-margin-end': '8px',
  } as CSSProperties
}

export const APP_TOAST_STYLE_ID = 'app-toast-overrides'
