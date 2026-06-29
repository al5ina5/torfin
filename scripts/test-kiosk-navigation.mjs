/**
 * Browser test for app-wide kiosk keyboard navigation.
 * Usage: UI_SMOKE_URL=http://127.0.0.1:5173 node scripts/test-kiosk-navigation.mjs
 */

import { chromium } from 'playwright'

const url = process.env.UI_SMOKE_URL || 'http://127.0.0.1:5173/series/trending'

async function dismissBlockingUi(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const closeButtons = page.getByRole('button', { name: 'Close' })
  if (await closeButtons.count()) {
    await closeButtons.first().click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(150)
  }
}

async function readCatalogFocus(page) {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.movie-item-enter'))
    const focused = items.findIndex(
      (el) => el.querySelector('.movie-focus-ring') || el.classList.contains('movie-focus-ring'),
    )
    const rect = items[focused]?.getBoundingClientRect()
    return {
      focused,
      left: rect ? Math.round(rect.left) : 0,
    }
  })
}

async function readKioskFocusZone(page) {
  return page.evaluate(() => {
    const focused = document.querySelector('.app-kiosk-focus')
    const zone = focused?.closest('[data-focus-zone]')?.getAttribute('data-focus-zone') ?? null
    const rect = focused?.getBoundingClientRect()
    return {
      zone,
      label: focused?.textContent?.trim().slice(0, 40) ?? '',
      top: rect ? Math.round(rect.top) : 0,
    }
  })
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

let failed = 0

function report(name, ok, detail = '') {
  const status = ok ? 'PASS' : 'FAIL'
  if (!ok) failed += 1
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ''}`)
}

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.movie-item-enter', { timeout: 15000 })
  await dismissBlockingUi(page)

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--right-sidebar-width', '0px')
  })
  await page.waitForTimeout(200)

  const beforeCatalog = await readCatalogFocus(page)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  const afterCatalog = await readCatalogFocus(page)
  report(
    'catalog-arrow-down',
    beforeCatalog.left === afterCatalog.left && afterCatalog.focused > beforeCatalog.focused,
    `#${beforeCatalog.focused} -> #${afterCatalog.focused}`,
  )

  for (let index = 0; index < 20; index += 1) {
    const catalog = await readCatalogFocus(page)
    if (catalog.focused <= 0) break
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(30)
  }
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(250)
  const toolbarFocus = await readKioskFocusZone(page)
  report('catalog-up-to-toolbar', toolbarFocus.zone === 'toolbar', toolbarFocus.label || 'no toolbar focus')

  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  const toolbarBack = await readCatalogFocus(page)
  report('toolbar-down-to-catalog', toolbarBack.focused >= 0, `focused #${toolbarBack.focused}`)

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(200)
  const sidebarFocus = await readKioskFocusZone(page)
  report(
    'catalog-left-edge-to-sidebar',
    sidebarFocus.zone === 'sidebar',
    sidebarFocus.label || 'no kiosk focus',
  )

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(250)

  await page.evaluate(() => {
    document.querySelector('.app-movie-scroll')?.scrollTo({ top: 99999 })
  })
  await page.waitForTimeout(300)
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(25)
  }
  const bottomCatalog = await readCatalogFocus(page)
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(250)
  const bottomSidebarFocus = await readKioskFocusZone(page)
  const sidebarButtons = await page.evaluate(() => {
    const zone = document.querySelector('[data-focus-zone="sidebar"]')
    const buttons = Array.from(zone?.querySelectorAll('button') ?? [])
    const tops = buttons.map((button) => Math.round(button.getBoundingClientRect().top))
    const moviesTop = tops[0] ?? 0
    return { moviesTop, focusedTop: document.querySelector('.app-kiosk-focus')?.getBoundingClientRect().top ?? 0 }
  })
  report(
    'bottom-catalog-enters-sidebar-nearby',
    bottomSidebarFocus.zone === 'sidebar' &&
      bottomSidebarFocus.top > sidebarButtons.moviesTop + 80,
    `catalog #${bottomCatalog.focused}, sidebar top ${bottomSidebarFocus.top}`,
  )

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(250)
  const catalogAgain = await readCatalogFocus(page)
  report('sidebar-right-to-catalog', catalogAgain.focused >= 0, `focused #${catalogAgain.focused}`)

  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  const inspectorVisible = await page.evaluate(() => Boolean(document.querySelector('[data-focus-zone="inspector"]')))
  report('enter-opens-inspector', inspectorVisible)

  if (inspectorVisible) {
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--right-sidebar-width', '520px')
    })
    await page.waitForTimeout(300)
    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(25)
    }
    const bottomBeforeInspector = await readCatalogFocus(page)
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(40)
    }
    await page.waitForTimeout(250)
    const inspectorFocus = await readKioskFocusZone(page)
    report(
      'bottom-catalog-enters-inspector-nearby',
      inspectorFocus.zone === 'inspector' && inspectorFocus.top > 300,
      `catalog #${bottomBeforeInspector.focused}, inspector top ${inspectorFocus.top}`,
    )

    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(250)
    const backToCatalog = await readCatalogFocus(page)
    report('inspector-left-to-catalog', backToCatalog.focused >= 0, `focused #${backToCatalog.focused}`)
  }

  await page.keyboard.press('Shift+/')
  await page.waitForTimeout(300)
  const shortcutsOpen = await page.locator('text=Keyboard Shortcuts').first().isVisible().catch(() => false)
  report('question-opens-shortcuts', shortcutsOpen)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  const shortcutsClosed = !(await page.locator('text=Keyboard Shortcuts').first().isVisible().catch(() => false))
  report('escape-closes-shortcuts', shortcutsClosed)

  if (failed > 0) {
    console.error(`\n${failed} kiosk navigation checks failed`)
    process.exit(1)
  }

  console.log('\nAll kiosk navigation checks passed')
} finally {
  await browser.close()
}
