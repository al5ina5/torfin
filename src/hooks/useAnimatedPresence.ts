import { useEffect, useRef, useState } from 'react'

const IOS_DRAWER_MS = 340

export function useAnimatedPresence(active: boolean, duration = IOS_DRAWER_MS) {
  const [mounted, setMounted] = useState(active)
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (active) {
      setMounted(true)
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true))
      })
      return () => window.cancelAnimationFrame(frame)
    }

    setVisible(false)
    timeoutRef.current = window.setTimeout(() => setMounted(false), duration)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [active, duration])

  return { mounted, visible }
}
