/**
 * Browser test for catalog arrow-key navigation.
 * Usage: UI_SMOKE_URL=http://127.0.0.1:5173 node scripts/test-catalog-navigation.mjs
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

async function readFocused(page) {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.movie-item-enter'))
    const names = items.map((el) => el.innerText.split('\n')[0])
    const focused = items.findIndex(
      (el) => el.querySelector('.movie-focus-ring') || el.classList.contains('movie-focus-ring'),
    )
    const rects = items.map((el, index) => {
      const rect = el.getBoundingClientRect()
      return {
        index: Number(el.dataset.catalogIndex ?? index),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        name: names[index],
      }
    })
    const rows = []
    for (const item of rects) {
      const row = rows.find((entry) => Math.abs(entry[0].top - item.top) <= 8)
      if (row) row.push(item)
      else rows.push([item])
    }
    const current = rects[focused] ?? rects[0]
    return {
      focused: current?.index ?? -1,
      name: current?.name ?? '',
      left: current?.left ?? 0,
      cols: rows[0]?.length ?? 0,
      rows: rows.slice(0, 3).map((row) => row.map((item) => `${item.index}:${item.name}`)),
    }
  })
}

async function pressArrow(page, key) {
  await page.keyboard.press(key)
  await page.waitForTimeout(300)
}

async function runScenario(page, label, setup) {
  await setup()
  const before = await readFocused(page)
  await pressArrow(page, 'ArrowDown')
  const after = await readFocused(page)
  const ok = before.left === after.left && after.left > 0 && after.focused !== before.focused
  return { label, ok, before, after }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.movie-item-enter', { timeout: 15000 })
  await dismissBlockingUi(page)

  const results = []

  results.push(
    await runScenario(page, 'grid-7-columns', async () => {
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--right-sidebar-width', '0px')
      })
      await page.waitForTimeout(250)
      await page.evaluate(() => {
        document.querySelector('.app-movie-scroll')?.scrollTo({ top: 0 })
      })
    }),
  )

  results.push(
    await runScenario(page, 'grid-4-columns', async () => {
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--right-sidebar-width', '520px')
      })
      await page.waitForTimeout(250)
    }),
  )

  results.push(
    await runScenario(page, 'list-mode', async () => {
      await page.evaluate(() => {
        localStorage.setItem(
          'torfin.preferences',
          JSON.stringify({
            ...(JSON.parse(localStorage.getItem('torfin.preferences') || '{}')),
            libraryViewMode: 'list',
          }),
        )
      })
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForSelector('.movie-item-enter', { timeout: 15000 })
      await dismissBlockingUi(page)
    }),
  )

  let failed = 0
  for (const result of results) {
    const status = result.ok ? 'PASS' : 'FAIL'
    if (!result.ok) failed += 1
    console.log(`\n${status} ${result.label}`)
    console.log(`  before: #${result.before.focused} ${result.before.name} @ left ${result.before.left} (${result.before.cols} cols)`)
    console.log(`  after:  #${result.after.focused} ${result.after.name} @ left ${result.after.left}`)
    if (!result.ok) {
      console.log(`  rows: ${JSON.stringify(result.before.rows)}`)
    }
  }

  if (failed > 0) {
    console.error(`\n${failed}/${results.length} navigation scenarios failed`)
    process.exit(1)
  }

  console.log(`\n${results.length}/${results.length} navigation scenarios passed`)
} finally {
  await browser.close()
}
