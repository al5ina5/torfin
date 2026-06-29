import { useEffect, useState } from 'react'

import { resolveThemeMode } from '../lib/theme'
import type { ThemeMode } from '../types'

export function useResolvedTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => resolveThemeMode())

  useEffect(() => {
    const root = document.documentElement

    const update = () => {
      setTheme(resolveThemeMode(root.dataset.theme as ThemeMode | undefined))
    }

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    update()

    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])

  return theme
}
