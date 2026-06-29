import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const root = await mkdtemp(join(tmpdir(), 'torbox-web-downloads-'))
const port = 43211
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    TORBOX_DATA_DIR: join(root, 'data'),
    TORBOX_DOWNLOAD_DIR: join(root, 'movies'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
server.stdout.on('data', (chunk) => { output += chunk })
server.stderr.on('data', (chunk) => { output += chunk })

async function api(path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, body ? {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`)
  return payload
}

try {
  for (let i = 0; i < 40; i += 1) {
    try {
      const health = await api('/api/health')
      if (health.ok) break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  const ids = ['smoke-a', 'smoke-b']
  await Promise.all(ids.map((id, index) => api('/api/downloads', {
    id,
    url: `https://speed.cloudflare.com/__down?bytes=${6_000_000 + index * 1_000_000}`,
    filename: `${id}.bin`,
    folderName: 'Concurrent Smoke',
  })))

  const deadline = Date.now() + 45_000
  let statuses = []
  while (Date.now() < deadline) {
    statuses = await Promise.all(ids.map((id) => api(`/api/downloads/${id}`)))
    if (statuses.some((status) => status.state.startsWith('error:'))) {
      throw new Error(JSON.stringify(statuses, null, 2))
    }
    if (statuses.every((status) => status.complete && status.downloaded > 0)) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  if (!statuses.every((status) => status.complete && status.downloaded > 0)) {
    throw new Error(`Timed out waiting for downloads: ${JSON.stringify(statuses, null, 2)}`)
  }

  console.log(JSON.stringify(statuses.map((status) => ({
    id: status.id,
    engine: status.engine,
    downloaded: status.downloaded,
    complete: status.complete,
  })), null, 2))
} finally {
  server.kill('SIGTERM')
  await new Promise((resolve) => server.on('exit', resolve))
  await rm(root, { recursive: true, force: true })
}
