import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

import type { FocusZone as FocusZoneName } from '../lib/focus-navigation'

type FocusZoneProps = HTMLAttributes<HTMLDivElement> & {
  zone: FocusZoneName
  children: ReactNode
}

/**
 * Marks a layout region for app-wide keyboard / kiosk navigation.
 * New screens only need this wrapper (or AppModal/AppDrawer) for automatic support.
 */
export const FocusZone = forwardRef<HTMLDivElement, FocusZoneProps>(function FocusZone(
  { zone, children, ...props },
  ref,
) {
  return (
    <div ref={ref} data-focus-zone={zone} {...props}>
      {children}
    </div>
  )
})
