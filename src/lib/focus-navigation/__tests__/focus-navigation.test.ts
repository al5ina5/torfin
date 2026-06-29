import { describe, expect, it, vi } from 'vitest'

import {
  findBlockingOverlayZone,
  findNearestCatalogIndex,
  findNearestFocusableByViewportY,
  findSpatialFocusNeighbor,
  getFocusables,
  isCatalogAtHorizontalEdge,
  tryDismissTopOverlay,
} from '../index'

function mountLayout(html: string) {
  document.body.innerHTML = html
  return document.body
}

function stubVisible(element: HTMLElement, rect: Partial<DOMRect>) {
  const layout = {
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    width: rect.width ?? 100,
    height: rect.height ?? 30,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: (rect.left ?? 0) + (rect.width ?? 100),
    bottom: (rect.top ?? 0) + (rect.height ?? 30),
    toJSON: () => ({}),
  } as DOMRect

  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(layout)
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    zIndex: '50',
  } as CSSStyleDeclaration)
}

describe('focus-navigation', () => {
  it('finds focusable controls inside a zone', () => {
    const root = mountLayout(`
      <div data-focus-zone="sidebar">
        <button type="button">One</button>
        <button type="button" disabled>Hidden</button>
        <button type="button" data-focus-ignore>Ignored</button>
        <button type="button">Two</button>
      </div>
    `).firstElementChild as HTMLElement

    for (const element of root.querySelectorAll('button')) {
      stubVisible(element as HTMLElement, { width: 80, height: 24 })
    }

    expect(getFocusables(root).map((element) => element.textContent)).toEqual(['One', 'Two'])
  })

  it('picks the focusable nearest by viewport Y', () => {
    const root = mountLayout(`
      <div data-focus-zone="sidebar">
        <button type="button">Top</button>
        <button type="button">Bottom</button>
      </div>
    `).firstElementChild as HTMLElement

    const buttons = Array.from(root.querySelectorAll('button')) as HTMLElement[]
    stubVisible(buttons[0]!, { top: 0, width: 80, height: 24 })
    stubVisible(buttons[1]!, { top: 200, width: 80, height: 24 })

    const nearest = findNearestFocusableByViewportY(getFocusables(root), 205)
    expect(nearest?.textContent).toBe('Bottom')
  })

  it('detects blocking modal overlays from the live DOM', () => {
    mountLayout(`
      <div class="app-modal-backdrop">
        <section data-focus-zone="modal" role="dialog" aria-modal="true">
          <button type="button" title="Close">Close</button>
        </section>
      </div>
    `)

    const modal = document.querySelector('[data-focus-zone="modal"]') as HTMLElement
    stubVisible(modal, { width: 400, height: 300 })

    expect(findBlockingOverlayZone(true)).toBe('modal')
  })

  it('dismisses the top overlay via its close button', () => {
    mountLayout(`
      <div class="app-modal-backdrop">
        <section data-focus-zone="modal" role="dialog" aria-modal="true">
          <button type="button" title="Close">Close</button>
        </section>
      </div>
    `)

    const modal = document.querySelector('[data-focus-zone="modal"]') as HTMLElement
    stubVisible(modal, { width: 400, height: 300 })
    const close = modal.querySelector('button') as HTMLElement
    stubVisible(close, { width: 20, height: 20 })

    let clicked = false
    close.addEventListener('click', () => {
      clicked = true
    })

    expect(tryDismissTopOverlay(true)).toBe(true)
    expect(clicked).toBe(true)
  })

  it('moves spatial focus down a vertical stack', () => {
    const root = mountLayout(`
      <div data-focus-zone="sidebar">
        <button type="button">A</button>
        <button type="button">B</button>
      </div>
    `).firstElementChild as HTMLElement

    for (const element of root.querySelectorAll('button')) {
      stubVisible(element as HTMLElement, { width: 80, height: 30 })
    }
    stubVisible(root, { width: 200, height: 200 })

    const focusables = getFocusables(root)
    stubVisible(focusables[0]!, { top: 0, width: 80, height: 30 })
    stubVisible(focusables[1]!, { top: 40, width: 80, height: 30 })

    expect(findSpatialFocusNeighbor(focusables, root, focusables[0]!, 'down')?.textContent).toBe('B')
  })

  it('detects left edge in catalog grid', () => {
    const root = mountLayout(`
      <div class="app-movie-scroll" data-focus-zone="catalog">
        <div class="catalog-grid">
          <button class="movie-item-enter" data-catalog-index="0">0</button>
          <button class="movie-item-enter" data-catalog-index="1">1</button>
          <button class="movie-item-enter" data-catalog-index="2">2</button>
        </div>
      </div>
    `).firstElementChild as HTMLElement

    const items = Array.from(root.querySelectorAll<HTMLElement>('.movie-item-enter'))
    stubVisible(items[0]!, { left: 0, top: 0, width: 100, height: 120 })
    stubVisible(items[1]!, { left: 108, top: 0, width: 100, height: 120 })
    stubVisible(items[2]!, { left: 216, top: 0, width: 100, height: 120 })

    expect(isCatalogAtHorizontalEdge(root, 0, 'left', 3)).toBe(true)
    expect(isCatalogAtHorizontalEdge(root, 1, 'left', 3)).toBe(false)
    expect(findNearestCatalogIndex(root, 50)).toBe(0)
  })
})
