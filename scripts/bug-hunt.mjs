/**
 * Aggressive navigation bug hunt — collects console errors and page errors.
 */
import { smokeTestInitScript } from './smoke-test-init.mjs'

const BASE_URL = process.env.UI_SMOKE_URL || 'http://127.0.0.1:3026/'

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const errors = []
  const pageErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
  })
  page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`))

  const flows = []

  async function step(name, fn) {
    try {
      await fn()
      flows.push({ name, ok: true })
    } catch (error) {
      flows.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) })
    }
  }

  await page.addInitScript(smokeTestInitScript)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })

  await step('load home', async () => {
    await page.locator('.app-shell').waitFor({ state: 'visible' })
  })

  await step('settings modal', async () => {
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.locator('.preferences-modal-panel').waitFor({ state: 'visible', timeout: 10000 })
    await page.getByRole('button', { name: 'Close' }).first().click()
    await page.locator('.app-modal-backdrop').waitFor({ state: 'hidden', timeout: 10000 })
  })

  await step('downloads modal', async () => {
    await page.getByRole('link', { name: 'Open download queue' }).click()
    await page.getByText('Download', { exact: true }).first().waitFor()
    await page.getByRole('button', { name: 'Close' }).first().click()
    await page.locator('.app-modal-backdrop').waitFor({ state: 'hidden', timeout: 10000 })
  })

  await step('filters modal', async () => {
    await page.getByTitle('Filters').click()
    await page.getByText('Filters', { exact: true }).first().waitFor()
    await page.getByRole('button', { name: 'Close' }).first().click()
    await page.locator('.app-modal-backdrop').waitFor({ state: 'hidden', timeout: 10000 })
  })

  await step('series tab', async () => {
    await page.getByRole('link', { name: 'Series' }).click()
    await page.getByRole('heading', { name: /Trending|Top Rated/i }).first().waitFor()
  })

  await step('watchlist empty', async () => {
    await page.getByRole('link', { name: 'Watchlist', exact: true }).click()
    await page.waitForTimeout(500)
  })

  await step('search matrix', async () => {
    await page.getByPlaceholder('Search').fill('matrix')
    await page.waitForTimeout(800)
    await page.getByPlaceholder('Search').fill('')
    await page.waitForTimeout(400)
  })

  await step('open movie + streams', async () => {
    await page.getByRole('link', { name: 'Movies' }).click()
    await page.getByRole('link', { name: 'Trending', exact: true }).click()
    await page.locator('.catalog-grid a img').first().waitFor({ state: 'visible', timeout: 60000 })
    await page.locator('.catalog-grid a').filter({ has: page.locator('img') }).first().click()
    await page.getByText('Stream Results').first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(2500)
  })

  await step('bad route recovery', async () => {
    await page.goto(new URL('not-a-real-route', BASE_URL).toString(), { waitUntil: 'domcontentloaded' })
    await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 10000 })
  })

  await step('deep link movie', async () => {
    await page.goto(new URL('movie/tt0111161', BASE_URL).toString(), { waitUntil: 'networkidle' })
    await page.getByText('Stream Results').first().waitFor({ timeout: 20000 })
  })

  await step('deep link series episode', async () => {
    await page.goto(new URL('series/tt0944947/1/1', BASE_URL).toString(), { waitUntil: 'networkidle' })
    await page.getByText('Stream Results').first().waitFor({ timeout: 20000 })
  })

  await browser.close()

  console.log('=== Flow results ===')
  for (const flow of flows) {
    console.log(`${flow.ok ? 'OK' : 'FAIL'} ${flow.name}${flow.detail ? ` — ${flow.detail}` : ''}`)
  }
  console.log(`\n=== Console errors (${errors.length}) ===`)
  for (const e of [...new Set(errors)]) console.log(e)
  console.log(`\n=== Page errors (${pageErrors.length}) ===`)
  for (const e of [...new Set(pageErrors)]) console.log(e)

  const failed = flows.filter((f) => !f.ok)
  if (failed.length || errors.length || pageErrors.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
