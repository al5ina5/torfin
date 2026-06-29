import toastStyles from '../components/app-toast.css?inline'

import { APP_TOAST_STYLE_ID } from './toast-config'

/** Append toast overrides after Sonner's runtime-injected CSS. */
export function installAppToastStyles() {
  if (typeof document === 'undefined') return

  let el = document.getElementById(APP_TOAST_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = APP_TOAST_STYLE_ID
    document.head.appendChild(el)
  }

  el.textContent = toastStyles
}
