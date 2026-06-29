import { STORAGE_KEYS, loadStoredString, saveStoredString } from './storage'
import type { ThemeMode } from '../types'

export function loadThemeMode(): ThemeMode {
  const stored = loadStoredString(STORAGE_KEYS.theme, 'system')
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function saveThemeMode(mode: ThemeMode) {
  saveStoredString(STORAGE_KEYS.theme, mode)
}

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode === 'system' ? 'light dark' : mode
}

export function initTheme() {
  applyThemeMode(loadThemeMode())
}

export function resolveThemeMode(mode: ThemeMode = loadThemeMode()): 'light' | 'dark' {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
