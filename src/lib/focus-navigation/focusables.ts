import { FOCUS_IGNORE_ATTR } from './types'

/** Interactive elements picked up automatically inside any focus zone. */
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([' + FOCUS_IGNORE_ATTR + '])',
  'a[href]',
  'select:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[role="button"]:not([disabled]):not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="option"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  '[data-focus-item]:not([disabled])',
].join(', ')

export const OVERLAY_CLOSE_SELECTORS = [
  'button[aria-label="Close"]',
  'button.app-drawer-close',
  'button[title="Close"]',
  '.app-modal-titlebar button',
  'button.app-confirm-sheet-action:not(.app-confirm-sheet-action-danger)',
].join(', ')
