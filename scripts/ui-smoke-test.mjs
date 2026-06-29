/**
 * UI smoke + UX flow test for Torfin.
 *
 * Usage:
 *   npm run test:ui
 *   UI_SMOKE_URL=http://127.0.0.1:5173 npm run test:ui
 */

const DEFAULT_URL = process.env.UI_SMOKE_URL || 'http://127.0.0.1:3020/'

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
  return response.text()
}

function ensureIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`)
  }
}

async function bundleFallback(url) {
  const html = await fetchText(url)
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  const scripts = await Promise.all(
    assets
      .filter((asset) => asset.endsWith('.js'))
      .map((asset) => fetchText(new URL(asset, url).toString()).catch(() => '')),
  )
  const corpus = `${html}\n${scripts.join('\n')}`
  for (const [needle, label] of [
    ['Torfin', 'title text'],
    ['Now', 'NOW section'],
    ['Stream Results', 'inspector section'],
    ['app-shell', 'layout class'],
    ['Resize library sidebar', 'splitter label'],
    ['Resize movie details sidebar', 'right splitter label'],
  ]) {
    ensureIncludes(corpus, needle, label)
  }
}

async function runWithPlaywright(url) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)

    // Shell layout
    await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByText('Torfin').first().waitFor({ state: 'visible' })
    await page.getByLabel('Resize library sidebar').waitFor({ state: 'visible' })
    await page.getByLabel('Resize movie details sidebar').waitFor({ state: 'visible' })

    // Sidebar: Settings/Downloads at bottom (not center toolbar)
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.locator('.preferences-modal-panel').waitFor({ state: 'visible', timeout: 10000 })
    await page.getByRole('button', { name: 'Close' }).first().click()

    // Catalog toolbar: title + search + filters only
    await page.getByRole('heading', { name: /Trending|Top Rated|Featured|New Releases|Action/i }).first().waitFor()
    await page.getByPlaceholder('Search').waitFor({ state: 'visible' })
    await page.getByTitle('Filters').waitFor({ state: 'visible' })

    // Wait for poster grid
    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll('button')]
      return buttons.some((button) => /\d{4}/.test(button.textContent || '') && button.querySelector('img'))
    }, { timeout: 30000 })

    // Select first movie with a poster
    const movieButton = page.locator('button').filter({ has: page.locator('img') }).first()
    const movieName = (await movieButton.textContent())?.split(/\d{4}/)[0]?.trim() || 'movie'
    await movieButton.click()

    // Inspector panel
    await page.getByText('Stream Results').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.getByRole('button', { name: 'Reliable' }).waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Fastest' }).waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Best' }).waitFor({ state: 'visible' })

    // Stream cards should expose play/download controls when results load
    await page.waitForTimeout(3000)
    const playButtons = page.getByTitle('Play with Torbox')
    if ((await playButtons.count()) > 0) {
      await playButtons.first().waitFor({ state: 'visible' })
    }

    // Downloads modal from sidebar
    await page.getByRole('button', { name: 'Downloads' }).click()
    await page.getByText('Download', { exact: true }).first().waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Close' }).first().click()

    console.log(`UX flow passed for "${movieName}" at ${url}`)
  } finally {
    await browser.close()
  }
}

async function main() {
  console.log(`Running UI smoke test against ${DEFAULT_URL}`)
  try {
    await runWithPlaywright(DEFAULT_URL)
    console.log('Playwright UX checks passed.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/Cannot find package 'playwright'|ERR_MODULE_NOT_FOUND|playwright.*not found/i.test(message)) {
      throw error
    }
    console.log('Playwright unavailable, falling back to bundle string checks.')
    await bundleFallback(DEFAULT_URL)
    console.log('Bundle fallback checks passed.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
