import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readAppRoute } from '../../lib/app-routes'
import type { ContentType } from '../../types'
import { useSearchQueryRoute } from '../useSearchQueryRoute'

vi.mock('../../lib/app-routes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/app-routes')>()
  return {
    ...actual,
    readAppRoute: vi.fn(actual.readAppRoute),
  }
})

function renderSearchHook(routeSearchQuery?: string) {
  const navigateSearch = vi.fn()
  const navigateBrowse = vi.fn()
  const routeRef = { current: { searchQuery: routeSearchQuery } }

  const hook = renderHook(() =>
    useSearchQueryRoute({
      initialQuery: '',
      route: routeRef.current,
      contentType: 'movie' as ContentType,
      catalogId: 'trending',
      navigateSearch,
      navigateBrowse,
    }),
  )

  return {
    ...hook,
    navigateSearch,
    navigateBrowse,
    setRouteSearchQuery(next?: string) {
      routeRef.current = { searchQuery: next }
      hook.rerender()
    },
  }
}

describe('useSearchQueryRoute', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(readAppRoute).mockReturnValue({
      contentType: 'movie',
      catalogId: 'trending',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('debounces navigation to the URL without rewriting the input', () => {
    const { result, navigateSearch, setRouteSearchQuery } = renderSearchHook()

    act(() => result.current.setQuery('matrix'))
    act(() => vi.advanceTimersByTime(300))

    expect(navigateSearch).toHaveBeenCalledWith('movie', 'matrix', true)
    expect(result.current.query).toBe('matrix')

    setRouteSearchQuery('matrix')
    expect(result.current.query).toBe('matrix')
  })

  it('does not flash back after the first debounce when typing continues', () => {
    const { result, navigateSearch, setRouteSearchQuery } = renderSearchHook()

    act(() => result.current.setQuery('hello'))
    act(() => vi.advanceTimersByTime(300))
    setRouteSearchQuery('hello')
    expect(result.current.query).toBe('hello')

    act(() => result.current.setQuery('hello world'))
    expect(result.current.query).toBe('hello world')

    act(() => vi.advanceTimersByTime(300))
    expect(navigateSearch).toHaveBeenLastCalledWith('movie', 'hello world', true)

    setRouteSearchQuery('hello world')
    expect(result.current.query).toBe('hello world')
  })

  it('keeps the latest query while debounce is pending after an earlier search', () => {
    const { result, setRouteSearchQuery } = renderSearchHook('matrix')

    act(() => result.current.setQuery('matrix reloaded'))
    expect(result.current.query).toBe('matrix reloaded')

    act(() => vi.advanceTimersByTime(150))
    act(() => result.current.setQuery('matrix reloaded 2'))
    expect(result.current.query).toBe('matrix reloaded 2')

    act(() => vi.advanceTimersByTime(300))
    setRouteSearchQuery('matrix reloaded 2')
    expect(result.current.query).toBe('matrix reloaded 2')
  })

  it('does not clear the input when leaving search for a short query', () => {
    const { result, navigateBrowse, setRouteSearchQuery } = renderSearchHook('hello')

    act(() => result.current.setQuery('h'))
    act(() => vi.advanceTimersByTime(300))

    expect(navigateBrowse).toHaveBeenCalledWith('movie', 'trending', true)
    setRouteSearchQuery(undefined)
    expect(result.current.query).toBe('h')
  })

  it('syncs the input from the URL on browser back/forward', () => {
    const { result } = renderSearchHook('hello')

    act(() => result.current.setQuery('hello world'))
    expect(result.current.query).toBe('hello world')

    vi.mocked(readAppRoute).mockReturnValue({
      contentType: 'movie',
      catalogId: 'trending',
      searchQuery: 'matrix',
    })

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(result.current.query).toBe('matrix')
  })
})
