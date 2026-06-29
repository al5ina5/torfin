import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyThemeMode, loadThemeMode, resolveThemeMode, saveThemeMode } from '../theme'

function createLocalStorageMock() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    get length() { return store.size },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
}

describe('theme', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to dark theme', () => {
    expect(loadThemeMode()).toBe('dark')
  })

  it('persists theme mode', () => {
    saveThemeMode('dark')
    expect(loadThemeMode()).toBe('dark')
  })

  it('applyThemeMode sets data-theme for explicit modes', () => {
    applyThemeMode('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    applyThemeMode('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('resolveThemeMode returns light or dark', () => {
    expect(['light', 'dark']).toContain(resolveThemeMode('light'))
    expect(['light', 'dark']).toContain(resolveThemeMode('dark'))
  })
})
