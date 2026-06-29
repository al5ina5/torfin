import { useRef, type TouchEvent } from 'react'

type SwipeDirection = 'left' | 'right' | 'down'

export function useSwipeDismiss(onDismiss: () => void, direction: SwipeDirection, threshold = 72) {
  const startX = useRef(0)
  const startY = useRef(0)
  const tracking = useRef(false)

  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0]
      if (!touch) return
      startX.current = touch.clientX
      startY.current = touch.clientY
      tracking.current = true
    },
    onTouchMove(event: TouchEvent) {
      if (!tracking.current) return
      const touch = event.touches[0]
      if (!touch) return
      const deltaX = touch.clientX - startX.current
      const deltaY = touch.clientY - startY.current
      if (direction === 'down') {
        if (Math.abs(deltaX) > Math.abs(deltaY) || deltaY < 0) {
          tracking.current = false
        }
      } else if (Math.abs(deltaY) > Math.abs(deltaX)) {
        tracking.current = false
      }
    },
    onTouchEnd(event: TouchEvent) {
      if (!tracking.current) return
      tracking.current = false
      const touch = event.changedTouches[0]
      if (!touch) return
      const deltaX = touch.clientX - startX.current
      const deltaY = touch.clientY - startY.current
      if (direction === 'down') {
        if (Math.abs(deltaX) > Math.abs(deltaY) || deltaY < 0) return
        if (deltaY > threshold) onDismiss()
        return
      }
      if (Math.abs(deltaY) > Math.abs(deltaX)) return
      if (direction === 'left' && deltaX < -threshold) onDismiss()
      if (direction === 'right' && deltaX > threshold) onDismiss()
    },
  }
}
