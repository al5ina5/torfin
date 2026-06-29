import { describe, expect, it, vi } from 'vitest'

import { handleAppLinkClick, isPlainLeftClick } from '../app-link'

function clickEvent(overrides: Partial<MouseEvent> = {}) {
  return {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent<HTMLAnchorElement>
}

describe('isPlainLeftClick', () => {
  it('accepts a plain left click', () => {
    expect(isPlainLeftClick(clickEvent())).toBe(true)
  })

  it('rejects modified clicks', () => {
    expect(isPlainLeftClick(clickEvent({ shiftKey: true }))).toBe(false)
    expect(isPlainLeftClick(clickEvent({ metaKey: true }))).toBe(false)
    expect(isPlainLeftClick(clickEvent({ ctrlKey: true }))).toBe(false)
    expect(isPlainLeftClick(clickEvent({ altKey: true }))).toBe(false)
    expect(isPlainLeftClick(clickEvent({ button: 1 }))).toBe(false)
    expect(isPlainLeftClick(clickEvent({ defaultPrevented: true }))).toBe(false)
  })
})

describe('handleAppLinkClick', () => {
  it('prevents default and navigates on plain left click', () => {
    const event = clickEvent()
    const onNavigate = vi.fn()
    handleAppLinkClick(event, onNavigate)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(onNavigate).toHaveBeenCalled()
  })

  it('does not navigate on shift-click', () => {
    const event = clickEvent({ shiftKey: true })
    const onNavigate = vi.fn()
    handleAppLinkClick(event, onNavigate)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
