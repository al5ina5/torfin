import { useCallback, useRef, useState } from 'react'

type UseCatalogPullRefreshArgs = {
  enabled: boolean
  onRefresh: () => Promise<void> | void
  scrollRef: React.RefObject<HTMLElement | null>
}

export function useCatalogPullRefresh({ enabled, onRefresh, scrollRef }: UseCatalogPullRefreshArgs) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || refreshing) return
      const scrollTop = scrollRef.current?.scrollTop ?? 0
      if (scrollTop > 4) return
      startYRef.current = event.touches[0]?.clientY ?? 0
      pullingRef.current = true
    },
    [enabled, refreshing, scrollRef],
  )

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!pullingRef.current || refreshing) return
      const delta = (event.touches[0]?.clientY ?? 0) - startYRef.current
      if (delta <= 0) {
        setPullDistance(0)
        return
      }
      setPullDistance(Math.min(delta * 0.45, 72))
    },
    [refreshing],
  )

  const onTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return
    pullingRef.current = false
    if (pullDistance >= 48 && !refreshing) {
      setRefreshing(true)
      setPullDistance(36)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
      return
    }
    setPullDistance(0)
  }, [onRefresh, pullDistance, refreshing])

  return {
    pullDistance,
    refreshing,
    pullRefreshHandlers: enabled
      ? { onTouchStart, onTouchMove, onTouchEnd }
      : {},
  }
}
