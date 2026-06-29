import { beforeEach, describe, expect, it, vi } from 'vitest'

import { hasThirdPartyAddonAck, markThirdPartyAddonAck } from '../third-party-addon-ack'
import { STORAGE_KEYS } from '../storage'

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

describe('third-party addon ack', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
  })

  it('tracks acknowledged addon ids', () => {
    expect(hasThirdPartyAddonAck('torrentio')).toBe(false)
    markThirdPartyAddonAck('torrentio')
    expect(hasThirdPartyAddonAck('torrentio')).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEYS.thirdPartyAddonAcks)).toContain('torrentio')
  })
})
