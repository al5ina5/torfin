import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getApi, loadJson, postApi, setApiRequestTimeoutSeconds } from '../api'

describe('api error handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setApiRequestTimeoutSeconds(15)
  })

  it('postApi throws server error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Invalid payload' }),
    } as Response)

    await expect(postApi('/api/test', {})).rejects.toThrow('Invalid payload')
  })

  it('postApi falls back to status text when no error field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => null,
    } as Response)

    await expect(postApi('/api/test', {})).rejects.toThrow('500 Internal Server Error')
  })

  it('getApi throws on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized' }),
    } as Response)

    await expect(getApi('/api/downloads')).rejects.toThrow('Unauthorized')
  })

  it('loadJson throws timeout message on abort', async () => {
    setApiRequestTimeoutSeconds(5)
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

    await expect(loadJson('https://v3-cinemeta.strem.io/catalog/movie/top.json')).rejects.toThrow(
      'Request timed out',
    )
  })

  it('loadJson throws server error from proxy', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: 'Backend not running' }),
    } as Response)

    await expect(loadJson('https://v3-cinemeta.strem.io/catalog/movie/top.json')).rejects.toThrow(
      'Backend not running',
    )
  })
})
