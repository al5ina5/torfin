import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('error-reporting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    vi.stubGlobal('navigator', {
      userAgent: 'test',
      sendBeacon: vi.fn().mockReturnValue(true),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports client errors to the API', async () => {
    const { reportClientError } = await import('../error-reporting')
    await reportClientError({
      kind: 'manual',
      message: 'test failure',
      stack: 'Error: test failure\n    at foo (bar.ts:1:1)',
    })
    expect(navigator.sendBeacon).toHaveBeenCalled()
  })

  it('dedupes identical errors in one session', async () => {
    const { reportClientError } = await import('../error-reporting')
    const payload = {
      kind: 'manual' as const,
      message: 'duplicate',
      stack: 'Error: duplicate\n    at foo (bar.ts:1:1)',
    }
    await reportClientError(payload)
    await reportClientError(payload)
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
  })
})
