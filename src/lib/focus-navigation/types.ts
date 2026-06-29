import type { CatalogNavigationDirection } from '../catalog-grid-navigation'

export type FocusZone = 'modal' | 'sidebar' | 'toolbar' | 'catalog' | 'inspector'

export type NavigationDirection = CatalogNavigationDirection

export const FOCUS_ZONE_ATTR = 'data-focus-zone'
export const KIOSK_FOCUS_CLASS = 'app-kiosk-focus'
export const FOCUS_IGNORE_ATTR = 'data-focus-ignore'
