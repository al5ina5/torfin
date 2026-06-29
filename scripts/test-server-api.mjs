/**
 * Server API integration tests — health, auth, downloads lifecycle, error paths.
 *
 * Usage: node scripts/test-server-api.mjs
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const root = await mkdtemp(join(tmpdir(), 'torfin-api-'))
const port = 43212
const apiKey = 'test-secret-key'

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    TORBOX_SERVER_API_KEY: apiKey,
    TORBOX_DATA_DIR: join(root, 'data'),
    TORBOX_DOWNLOAD_DIR: join(root, 'movies'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let serverOutput = ''
server.stdout.on('data', (chunk) => { serverOutput += chunk })
server.stderr.on('data', (chunk) => { serverOutput += chunk })

const results = []
function log(caseName, ok, detail = '') {
  results.push({ case: caseName, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${caseName}${detail ? `: ${detail}` : ''}`)
}

async function waitForHealth(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok) return
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error(`Server did not start in time.\n${serverOutput}`)
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body) headers['content-type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

try {
  await waitForHealth()
  log('server starts and health responds', true)

  // Health is public even with API key set
  {
    const { response, payload } = await api('/api/health')
    log('GET /api/health returns ok', response.ok && payload?.ok === true)
    log('health reports ffmpeg availability', typeof payload?.ffmpeg === 'boolean')
  }

  // Auth enforcement
  {
    const { response, payload } = await api('/api/downloads')
    log('GET /api/downloads without auth returns 401', response.status === 401, payload?.error)
    const authed = await api('/api/downloads', { token: apiKey })
    log('GET /api/downloads with auth returns 200', authed.response.ok)
  }

  // fetch-json allowlist
  {
    const bad = await api('/api/fetch-json?url=https://evil.example.com/x.json', { token: apiKey })
    log('fetch-json rejects disallowed host', bad.response.status === 500 || bad.response.status === 400 || !bad.response.ok)
    const good = await api(
      `/api/fetch-json?url=${encodeURIComponent('https://v3-cinemeta.strem.io/catalog/movie/top.json')}`,
      { token: apiKey },
    )
    log('fetch-json allows cinemeta', good.response.ok, good.payload ? 'got catalog' : good.payload?.error)
  }

  // Download lifecycle
  const downloadId = `api-test-${Date.now()}`
  {
    const start = await api('/api/downloads', {
      method: 'POST',
      token: apiKey,
      body: {
        id: downloadId,
        url: 'https://speed.cloudflare.com/__down?bytes=500000',
        filename: 'api-test.bin',
        folderName: 'API Test',
      },
    })
    log('POST /api/downloads starts job', start.response.ok, start.payload?.id || start.payload?.error)

    const status = await api(`/api/downloads/${downloadId}`, { token: apiKey })
    log('GET /api/downloads/:id tracks job', status.response.ok, status.payload?.state)

    const pause = await api(`/api/downloads/${downloadId}/pause`, { method: 'POST', token: apiKey })
    log('POST pause succeeds', pause.response.ok)

    const resume = await api(`/api/downloads/${downloadId}/resume`, { method: 'POST', token: apiKey })
    log('POST resume succeeds', resume.response.ok)

    const deadline = Date.now() + 30_000
    let final = status.payload
    while (Date.now() < deadline) {
      const poll = await api(`/api/downloads/${downloadId}`, { token: apiKey })
      final = poll.payload
      if (final?.complete || String(final?.state || '').startsWith('error:')) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    log('download completes', Boolean(final?.complete && final?.downloaded > 0), JSON.stringify({ state: final?.state, downloaded: final?.downloaded }))

    const del = await api(`/api/downloads/${downloadId}`, { method: 'DELETE', token: apiKey })
    log('DELETE /api/downloads/:id succeeds', del.response.ok)
  }

  // Error paths
  {
    const missing = await api('/api/downloads/nonexistent-id-xyz', { token: apiKey })
    log('GET missing download returns error', !missing.response.ok, missing.payload?.error)

    const notFound = await api('/api/not-a-route', { token: apiKey })
    log('unknown route returns 404', notFound.response.status === 404)

    const badResolve = await api('/api/resolve-torbox-stream', {
      method: 'POST',
      token: apiKey,
      body: { token: '', infoHash: null, fileIdx: null, filename: 'x', directUrl: null },
    })
    log('resolve-torbox-stream rejects empty token', !badResolve.response.ok, badResolve.payload?.error)
  }

  // Static serving
  {
    const index = await fetch(`http://127.0.0.1:${port}/`)
    const html = await index.text()
    log('serves index.html', index.ok && html.includes('Torfin'))
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.error('Failures:', failed)
    process.exitCode = 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error(serverOutput.slice(-2000))
  process.exitCode = 1
} finally {
  server.kill('SIGTERM')
  await new Promise((resolve) => server.on('exit', resolve))
  await rm(root, { recursive: true, force: true })
}
