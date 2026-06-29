import { useEffect, useState } from 'react'

import { readAppRoute } from '../lib/app-routes'
import { useDebouncedValue } from './useDebouncedValue'
import type { ContentType } from '../types'

type SearchRoute = {
  searchQuery?: string
}

type UseSearchQueryRouteArgs = {
  initialQuery?: string
  route: SearchRoute
  contentType: ContentType
  catalogId: string
  navigateSearch: (contentType: ContentType, query: string, replace?: boolean) => void
  navigateBrowse: (contentType: ContentType, catalogId: string, replace?: boolean) => void
  debounceMs?: number
}

export function useSearchQueryRoute({
  initialQuery = '',
  route,
  contentType,
  catalogId,
  navigateSearch,
  navigateBrowse,
  debounceMs = 300,
}: UseSearchQueryRouteArgs) {
  const [query, setQuery] = useState(initialQuery)
  const debouncedQuery = useDebouncedValue(query, debounceMs).trim()

  useEffect(() => {
    const onPopState = () => setQuery(readAppRoute().searchQuery ?? '')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      if (route.searchQuery !== debouncedQuery) {
        navigateSearch(contentType, debouncedQuery, true)
      }
      return
    }
    if (route.searchQuery) {
      navigateBrowse(contentType, catalogId, true)
    }
  }, [catalogId, contentType, debouncedQuery, navigateBrowse, navigateSearch, route.searchQuery])

  return { query, setQuery, debouncedQuery }
}
