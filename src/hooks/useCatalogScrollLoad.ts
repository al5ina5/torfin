import { useEffect, useRef } from 'react'

type UseCatalogScrollLoadArgs = {
  scrollRef: React.RefObject<HTMLElement | null>
  loadMoreRef: React.RefObject<HTMLElement | null>
  loadNextPage: () => void | Promise<void>
  enabled: boolean
  itemCount: number
  layoutKey?: string | number
}

export function useCatalogScrollLoad({
  scrollRef,
  loadMoreRef,
  loadNextPage,
  enabled,
  itemCount,
  layoutKey = 0,
}: UseCatalogScrollLoadArgs) {
  const loadNextPageRef = useRef(loadNextPage)
  loadNextPageRef.current = loadNextPage

  useEffect(() => {
    if (!enabled) return
    let observer: IntersectionObserver | null = null
    let raf = 0

    const attach = () => {
      const root = scrollRef.current
      const marker = loadMoreRef.current
      if (!root || !marker) {
        raf = window.requestAnimationFrame(attach)
        return
      }

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            void loadNextPageRef.current()
          }
        },
        { root, rootMargin: '320px 0px' },
      )
      observer.observe(marker)
    }

    attach()
    return () => {
      window.cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [enabled, itemCount, layoutKey, loadMoreRef, scrollRef])

  useEffect(() => {
    if (!enabled) return
    const root = scrollRef.current
    if (!root) return
    if (itemCount > 0 && root.scrollHeight > root.clientHeight + 16) return
    void loadNextPageRef.current()
  }, [enabled, itemCount, layoutKey, scrollRef])
}
