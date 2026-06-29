import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadStoredJson, loadStoredString, saveStoredJson, saveStoredString } from '../storage'

function createLocalStorageMock() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
}

describe('storage helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
  })

  it('loads string fallback when key missing', () => {
    expect(loadStoredString('missing', 'default')).toBe('default')
  })

  it('round-trips strings', () => {
    saveStoredString('test.key', 'hello')
    expect(loadStoredString('test.key')).toBe('hello')
  })

  it('loads json fallback when key missing', () => {
    expect(loadStoredJson('missing', { a: 1 })).toEqual({ a: 1 })
  })

  it('round-trips json', () => {
    saveStoredJson('test.json', { plugins: [1, 2] })
    expect(loadStoredJson('test.json', [])).toEqual({ plugins: [1, 2] })
  })

  it('returns fallback for invalid json', () => {
    localStorage.setItem('bad', '{not json')
    expect(loadStoredJson('bad', ['fallback'])).toEqual(['fallback'])
  })
})
