/**
 * Full stability test runner with structured logging.
 * Runs unit, build, and server integration tests.
 * For UI tests, start the server first: PORT=3025 node server.mjs
 *   then: UI_SMOKE_URL=http://127.0.0.1:3025 node scripts/test-all.mjs --ui
 *
 * Usage:
 *   npm run test:all
 *   npm run test:all -- --ui
 */

import { spawn } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const includeUi = args.has('--ui')
const url = process.env.UI_SMOKE_URL || 'http://127.0.0.1:3020/'

const suites = [
  { name: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'unit', cmd: 'npm', args: ['run', 'test'] },
  { name: 'build', cmd: 'npm', args: ['run', 'build'] },
  { name: 'transcode', cmd: 'npm', args: ['run', 'test:transcode'] },
  { name: 'web-downloads', cmd: 'npm', args: ['run', 'test:web-downloads'] },
  { name: 'server-api', cmd: 'npm', args: ['run', 'test:server-api'] },
]

if (includeUi) {
  suites.push(
    { name: 'ui-smoke', cmd: 'node', args: ['scripts/ui-smoke-test.mjs'], env: { UI_SMOKE_URL: url } },
    { name: 'search-debounce', cmd: 'node', args: ['scripts/test-search-debounce.mjs'], env: { UI_SMOKE_URL: url } },
  )
}

const results = []

function runSuite(suite) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(suite.cmd, suite.args, {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, ...suite.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('close', (code) => {
      const elapsed = ((Date.now() - started) / 1000).toFixed(1)
      const ok = code === 0
      results.push({ name: suite.name, ok, elapsed, code })
      console.log(`\n${'='.repeat(60)}`)
      console.log(`${ok ? 'PASS' : 'FAIL'} ${suite.name} (${elapsed}s)`)
      if (!ok) console.log(output.slice(-4000))
      resolve(ok)
    })
  })
}

console.log('Torfin stability test run')
console.log(`UI tests: ${includeUi ? `enabled (${url})` : 'skipped (pass --ui)'}`)

let allOk = true
for (const suite of suites) {
  const ok = await runSuite(suite)
  if (!ok) allOk = false
}

console.log(`\n${'='.repeat(60)}`)
console.log('Summary:')
for (const result of results) {
  console.log(`  ${result.ok ? '✓' : '✗'} ${result.name} (${result.elapsed}s)`)
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} suites passed`)

if (!allOk) process.exit(1)
