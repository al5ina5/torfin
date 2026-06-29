/**
 * Verifies search input does not flash back after debounce while typing continues.
 *
 * Usage:
 *   npm run dev
 *   node scripts/test-search-debounce.mjs
 */

const URL = process.env.UI_SMOKE_URL || 'http://127.0.0.1:5173/'

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const search = page.getByPlaceholder('Search')
    await search.waitFor({ state: 'visible', timeout: 15000 })

    await search.fill('hello')
    await page.waitForTimeout(400)
    await expectValue(search, 'hello', 'after first debounce')

    await search.pressSequentially(' world', { delay: 40 })
    await expectValue(search, 'hello world', 'immediately after continued typing')

    await page.waitForTimeout(400)
    await expectValue(search, 'hello world', 'after second debounce')

    await search.pressSequentially('!', { delay: 40 })
    await page.waitForTimeout(400)
    await expectValue(search, 'hello world!', 'after third debounce')

    console.log('search debounce test passed')
  } finally {
    await browser.close()
  }
}

async function expectValue(locator, expected, label) {
  const actual = await locator.inputValue()
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}" but got "${actual}"`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
