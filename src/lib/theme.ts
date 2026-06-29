import { STORAGE_KEYS, loadStoredString, saveStoredString } from './storage'
import type { ThemeMode } from '../types'

export const THEME_WINDOW_COLORS = {
  light: '#f5f5f7',
  dark: '#131315',
} as const

export function loadThemeMode(): ThemeMode {
  const stored = loadStoredString(STORAGE_KEYS.theme, 'dark')
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function saveThemeMode(mode: ThemeMode) {
  saveStoredString(STORAGE_KEYS.theme, mode)
}

function updateThemeColorMeta(resolved: 'light' | 'dark') {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_WINDOW_COLORS[resolved])
}

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode === 'system' ? 'light dark' : mode
  updateThemeColorMeta(resolveThemeMode(mode))
}

export function initTheme() {
  const mode = loadThemeMode()
  applyThemeMode(mode)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (loadThemeMode() === 'system') {
      updateThemeColorMeta(resolveThemeMode('system'))
    }
  })
}

export function resolveThemeMode(mode: ThemeMode = loadThemeMode()): 'light' | 'dark' {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
