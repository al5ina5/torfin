import { createServer } from 'node:http'
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, normalize, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { fetchTorboxAccount, isVideoFilename, normalizeAllowedFetchJsonUrl, resolveTorboxStream } from './server/torbox.mjs'
import { isFfmpegAvailable, getHlsTranscodeProgress, probeMedia, seekHlsTranscode, serveHlsTranscodeFile, startHlsTranscode } from './server/transcode.mjs'
import {
  batchLookupJellyfinLibrary,
  fetchJellyfinFavorites,
  jellyfinPathForJob as jellyfinPathForJobFromModule,
  lookupJellyfinLibrary,
  lookupJellyfinSeasonEpisodes,
  refreshJellyfin,
  verifyJellyfinImport,
  waitForJellyfinImport as waitForJellyfinImportFromModule,
} from './server/jellyfin.mjs'
import { createErrorLogger } from './server/error-log.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, 'dist')

function isDockerRuntime() {
  try {
    return existsSync('/.dockerenv')
  } catch {
    return false
  }
}

function defaultDataRoot() {
  if (process.env.TORBOX_DATA_DIR) return process.env.TORBOX_DATA_DIR
  if (isDockerRuntime()) return '/data'
  if (process.env.NODE_ENV === 'production') return '/data'
  return join(__dirname, 'data')
}

const dataDir = defaultDataRoot()
const jobsFile = join(dataDir, 'downloads.json')
const serverLogFile = join(dataDir, 'server.log')
const downloadLogDir = join(dataDir, 'logs')
const jsonCacheDir = join(dataDir, 'json-cache')
const { errorsLogFile, logError, installProcessHandlers } = createErrorLogger(dataDir)
installProcessHandlers()

function defaultDownloadRoot() {
  if (process.env.TORBOX_DOWNLOAD_DIR) return process.env.TORBOX_DOWNLOAD_DIR
  if (isDockerRuntime()) return '/media/movies'
  if (process.env.NODE_ENV === 'production') return '/media/movies'
  return join(homedir(), 'Downloads', 'Torfin')
}

function expandUserPath(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return trimmed
  if (trimmed === '~') return homedir()
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return join(homedir(), trimmed.slice(2))
  }
  return trimmed
}

function resolveDownloadRoot(savePath) {
  const expandedDefault = resolve(expandUserPath(defaultDownloadDir))
  const raw = String(savePath || '').trim()
  if (!raw) return expandedDefault
  if (raw === '/media/movies' && defaultDownloadDir !== '/media/movies') {
    return expandedDefault
  }
  return resolve(expandUserPath(raw))
}

const defaultDownloadDir = defaultDownloadRoot()
const defaultJellyfinUrl = process.env.JELLYFIN_URL || ''
const defaultJellyfinApiKey = process.env.JELLYFIN_API_KEY || ''
const jellyfinPathMapFrom = process.env.JELLYFIN_PATH_MAP_FROM || defaultDownloadDir
const jellyfinPathMapTo = process.env.JELLYFIN_PATH_MAP_TO || '/movies'
const port = Number(process.env.PORT || 3020)
const isDevelopment = process.env.NODE_ENV === 'development'
const aria2Split = String(Number(process.env.TORBOX_ARIA2_SPLIT || 16))
const aria2Connections = String(Number(process.env.TORBOX_ARIA2_CONNECTIONS || 16))
const aria2ConcurrentDownloads = String(Number(process.env.TORBOX_ARIA2_CONCURRENT_DOWNLOADS || 10))
const aria2MinSplitSize = process.env.TORBOX_ARIA2_MIN_SPLIT_SIZE || '1M'
const aria2RpcPort = Number(process.env.TORBOX_ARIA2_RPC_PORT || 6800)
const aria2SessionFile = join(dataDir, 'aria2.session')
const jsonFetchCacheMs = Number(process.env.TORBOX_JSON_FETCH_CACHE_MS || 3600000)
const jsonFetchTimeoutMs = Number(process.env.TORBOX_JSON_FETCH_TIMEOUT_MS || 8000)
const serverApiKey = String(process.env.TORBOX_SERVER_API_KEY || '').trim()
const isProduction = process.env.NODE_ENV === 'production'
const currentReleaseYear = new Date().getUTCFullYear()

if (!serverApiKey) {
  const mode = isProduction ? 'production' : 'non-production'
  console.warn(`TORBOX_SERVER_API_KEY is not set; API routes are open (${mode}). Set a key before exposing Torfin to a network.`)
}

mkdirSync(dataDir, { recursive: true })
mkdirSync(downloadLogDir, { recursive: true })
mkdirSync(jsonCacheDir, { recursive: true })
mkdirSync(defaultDownloadDir, { recursive: true })

/** @type {Map<string, import('node:child_process').ChildProcess>} */
const activeProcesses = new Map()
/** @type {import('node:child_process').ChildProcess | null} */
let aria2Daemon = null
let aria2DaemonReady = null
/** @type {Record<string, any>} */
let jobs = loadJobs()
const jsonFetchCache = new Map()
const jsonFetchInflight = new Map()

if (!existsSync(aria2SessionFile)) writeFileSync(aria2SessionFile, '')

const prewarmGenreLabels = [
  'Action',
  'Adventure',
  'Animation',
  'Biography',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'Film-Noir',
  'History',
  'Horror',
  'Music',
  'Musical',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Sport',
  'Thriller',
  'War',
  'Western',
]

const prewarmJsonUrls = [
  'https://v3-cinemeta.strem.io/catalog/movie/top.json',
  'https://v3-cinemeta.strem.io/catalog/movie/imdbRating.json',
  `https://v3-cinemeta.strem.io/catalog/movie/year/genre=${encodeURIComponent(String(currentReleaseYear))}.json`,
  ...prewarmGenreLabels.map(
    (genre) => `https://v3-cinemeta.strem.io/catalog/movie/top/genre=${encodeURIComponent(genre)}.json`,
  ),
]

function loadJobs() {
  try {
    return JSON.parse(readFileSync(jobsFile, 'utf8'))
  } catch {
    return {}
  }
}

function saveJobs() {
  writeFileSync(jobsFile, JSON.stringify(jobs, null, 2))
}

function commandExists(command) {
  return spawnSync('sh', ['-lc', `command -v ${command} >/dev/null 2>&1`]).status === 0
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function aria2Rpc(method, params = []) {
  const response = await fetch(`http://127.0.0.1:${aria2RpcPort}/jsonrpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}-${Math.random()}`,
      method: `aria2.${method}`,
      params,
    }),
  })
  const body = await response.json()
  if (body.error) throw new Error(body.error.message || `aria2 ${method} failed`)
  return body.result
}

function aria2StatusUris(status) {
  return (status?.files || [])
    .flatMap((file) => file?.uris || [])
    .map((uri) => String(uri?.uri || ''))
    .filter(Boolean)
}

function aria2StatusMatchesJob(status, job) {
  if (!status || !job?.url) return true
  return aria2StatusUris(status).some((uri) => uri === job.url)
}

async function removeAria2Gid(gid) {
  try {
    await aria2Rpc('remove', [gid])
  } catch {
    try {
      await aria2Rpc('removeDownloadResult', [gid])
    } catch {
      // The gid may already be gone.
    }
  }
}

async function removeAria2StatusesForPath(path, shouldRemove, reason, job = null) {
  const fields = ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'files']
  const groups = await Promise.all([
    aria2Rpc('tellActive', [fields]).catch(() => []),
    aria2Rpc('tellWaiting', [0, 1000, fields]).catch(() => []),
  ])
  const matches = groups
    .flat()
    .filter((status) => Array.isArray(status.files) && status.files.some((file) => file.path === path))
    .filter(shouldRemove)

  for (const status of matches) {
    await removeAria2Gid(status.gid)
    if (job) {
      appendJobLog(job, 'download.aria2_entry_removed', {
        reason,
        gid: status.gid,
        ariaState: status.status || '',
        urls: aria2StatusUris(status).map(redact).slice(0, 3),
      })
    }
    logEvent('download.aria2_entry_removed', { id: job?.id || '', reason, gid: status.gid })
  }

  return matches.length
}

async function findAria2StatusForJob(job) {
  const fields = ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'errorCode', 'errorMessage', 'files']
  const groups = await Promise.all([
    aria2Rpc('tellActive', [fields]).catch(() => []),
    aria2Rpc('tellWaiting', [0, 1000, fields]).catch(() => []),
  ])
  return groups.flat().find((status) =>
    aria2StatusMatchesJob(status, job)
    && Array.isArray(status.files)
    && status.files.some((file) => file.path === job.partialPath),
  )
}

async function ensureAria2Daemon() {
  if (!commandExists('aria2c')) return false
  if (aria2DaemonReady) {
    await aria2DaemonReady
    return true
  }

  aria2DaemonReady = (async () => {
    aria2Daemon = spawn(
      'aria2c',
      [
        '--enable-rpc=true',
        '--rpc-listen-all=false',
        `--rpc-listen-port=${aria2RpcPort}`,
        '--continue=true',
        '--auto-file-renaming=false',
        '--allow-overwrite=true',
        '--file-allocation=none',
        `--split=${aria2Split}`,
        `--max-concurrent-downloads=${aria2ConcurrentDownloads}`,
        `--max-connection-per-server=${aria2Connections}`,
        `--min-split-size=${aria2MinSplitSize}`,
        '--retry-wait=5',
        '--max-tries=0',
        '--timeout=60',
        '--connect-timeout=30',
        '--summary-interval=0',
        '--console-log-level=warn',
        '--download-result=hide',
        `--input-file=${aria2SessionFile}`,
        `--save-session=${aria2SessionFile}`,
        '--save-session-interval=5',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    aria2Daemon.stderr.on('data', (chunk) => {
      logEvent('aria2.stderr', { text: chunk.toString().slice(0, 1000) })
    })
    aria2Daemon.on('close', (code) => {
      logEvent('aria2.closed', { code })
      aria2Daemon = null
      aria2DaemonReady = null
    })

    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        await aria2Rpc('getVersion')
        logEvent('aria2.ready', { port: aria2RpcPort })
        return
      } catch {
        await sleep(100)
      }
    }
    throw new Error('aria2 RPC did not become ready.')
  })()

  await aria2DaemonReady
  return true
}

function redact(value) {
  return String(value || '').replace(/([?&](?:token|apikey|api_key|key)=)[^&\s]+/gi, '$1[redacted]')
}

function publicError(value) {
  return redact(String(value || ''))
}

function unlinkIfExists(path) {
  try {
    if (existsSync(path)) unlinkSync(path)
  } catch (error) {
    logEvent('file.cleanup_failed', { path, error: error.message })
  }
}

function cleanupDownloadArtifacts(job) {
  for (const path of [
    job.partialPath,
    `${job.partialPath}.aria2`,
    `${job.targetPath}.aria2`,
    `${job.targetPath}.torfin-url`,
    `${job.targetPath}.torfin-status`,
    `${job.targetPath}.torfin-error`,
    `${job.targetPath}.torfin-size`,
  ]) {
    unlinkIfExists(path)
  }
}

function logEvent(event, fields = {}) {
  const entry = {
    at: new Date().toISOString(),
    event,
    ...fields,
  }
  try {
    appendFileSync(serverLogFile, `${JSON.stringify(entry)}\n`)
  } catch {
    // Logging must never break downloads.
  }
  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify(entry))
  }
}

function appendJobLog(job, message, fields = {}) {
  if (!job?.logPath) return
  const entry = {
    at: new Date().toISOString(),
    message,
    ...fields,
  }
  try {
    appendFileSync(job.logPath, `${JSON.stringify(entry)}\n`)
  } catch {
    // Logging must never break downloads.
  }
}

function completeJob(job, source = 'finalize') {
  if (existsSync(job.targetPath)) {
    job.complete = true
    job.state = 'complete'
    job.error = ''
    job.downloaded = statSync(job.targetPath).size
    job.size = job.downloaded
    delete job.gid
    job.stalledSince = ''
    cleanupDownloadArtifacts(job)
    appendJobLog(job, 'download.complete', { downloaded: job.downloaded, size: job.size, source })
    logEvent('download.complete', { id: job.id, downloaded: job.downloaded, engine: job.engine, source })
    void refreshConfiguredJellyfin(job)
    return true
  }

  if (existsSync(job.partialPath)) {
    renameSync(job.partialPath, job.targetPath)
    job.complete = true
    job.state = 'complete'
    job.error = ''
    job.downloaded = statSync(job.targetPath).size
    job.size = job.downloaded
    delete job.gid
    job.stalledSince = ''
    cleanupDownloadArtifacts(job)
    appendJobLog(job, 'download.complete', { downloaded: job.downloaded, size: job.size, source })
    logEvent('download.complete', { id: job.id, downloaded: job.downloaded, engine: job.engine, source })
    void refreshConfiguredJellyfin(job)
    return true
  }

  if (job.complete) {
    job.state = 'complete'
    job.error = ''
    appendJobLog(job, 'download.complete_missing_output_ignored', { source })
    return true
  }

  throw new Error(`Download output is missing: ${job.partialPath}`)
}

function ensureJobLogPath(job) {
  if (!job?.id) return
  if (!job.logPath) {
    job.logPath = join(downloadLogDir, `${sanitizeFilename(job.id, 'download')}.log`)
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message })
}

function isAuthorizedApiRequest(request, pathname) {
  if (!serverApiKey) return true
  if (pathname === '/api/health') return true
  const authHeader = String(request.headers.authorization || '')
  const expected = `Bearer ${serverApiKey}`
  return authHeader === expected
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) body += chunk
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new Error('Request body is not valid JSON.')
  }
}

function sanitizeFilename(value, fallback = 'Torfin Download.mkv') {
  const cleaned = String(value || '')
    .replace(/[\\/:"*?<>|]+/g, ' ')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? ' ' : character))
    .join('')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
  return cleaned || fallback
}

function safeTargetPath(downloadDir, folderName, filename) {
  const root = resolveDownloadRoot(downloadDir)
  const folder = folderName ? sanitizeFilename(folderName, '') : ''
  const targetDir = resolve(root, folder)
  if (!targetDir.startsWith(root)) throw new Error('Download folder escapes the configured root.')
  mkdirSync(targetDir, { recursive: true })
  return join(targetDir, sanitizeFilename(filename))
}

function normalizeUrl(value) {
  const url = new URL(String(value || '').trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Downloads need a resolved HTTP or HTTPS Torbox URL.')
  }
  return url.toString()
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    const detail = body?.detail || body?.error || body?.message || text || `${response.status} ${response.statusText}`
    throw new Error(detail)
  }
  return body
}

function parseJsonText(text, url) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Invalid JSON from ${url}`)
  }
}

function jsonCachePath(url) {
  const key = createHash('sha256').update(url).digest('hex')
  return join(jsonCacheDir, `${key}.json`)
}

function readCachedJson(url) {
  const memory = jsonFetchCache.get(url)
  if (memory && Date.now() - memory.at < jsonFetchCacheMs) {
    return memory.body
  }

  const path = jsonCachePath(url)
  try {
    const stat = statSync(path)
    const age = Date.now() - stat.mtimeMs
    if (age > jsonFetchCacheMs) {
      logEvent('json_fetch.cache_stale_disk', { url: redact(url), age })
      return null
    }
    const body = JSON.parse(readFileSync(path, 'utf8'))
    jsonFetchCache.set(url, { at: stat.mtimeMs, body })
    return body
  } catch (error) {
    logEvent('json_fetch.cache_miss', { url: redact(url), error: error.message })
    return null
  }
}

function writeCachedJson(url, body) {
  jsonFetchCache.set(url, { at: Date.now(), body })
  try {
    writeFileSync(jsonCachePath(url), JSON.stringify(body))
  } catch (error) {
    logEvent('json_fetch.cache_write_failed', { url: redact(url), error: error.message })
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = jsonFetchTimeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    if (!response.ok) {
      const body = text ? parseJsonText(text, url) : null
      const detail = body?.detail || body?.error || body?.message || text || `${response.status} ${response.statusText}`
      throw new Error(detail)
    }
    return parseJsonText(text, url)
  } finally {
    clearTimeout(timer)
  }
}

function fetchJsonWithWget(url) {
  if (!commandExists('wget')) throw new Error('wget fallback is not available.')
  return new Promise((resolvePromise, reject) => {
    const child = spawn('wget', ['-qO-', '--timeout=20', '--tries=1', '--header=accept: application/json', '--user-agent=Torfin/1.0.0-beta', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('wget timed out'))
    }, 25000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (stdout.length > 20 * 1024 * 1024) {
        child.kill('SIGTERM')
        reject(new Error('JSON response is too large.'))
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error((stderr || stdout || `wget exited ${code}`).trim()))
        return
      }
      try {
        resolvePromise(parseJsonText(stdout, url))
      } catch (error) {
        reject(error)
      }
    })
  })
}

async function fetchCachedJson(url, options = {}) {
  const cached = readCachedJson(url)
  if (cached) return cached
  const inflight = jsonFetchInflight.get(url)
  if (inflight) return inflight

  const promise = (async () => {
    try {
      const body = await fetchJsonWithWget(url)
      writeCachedJson(url, body)
      return body
    } catch (wgetError) {
      try {
        const body = await fetchJsonWithTimeout(url, options)
        writeCachedJson(url, body)
        logEvent('json_fetch.node_fallback_ok', { url: redact(url), error: wgetError.message })
        return body
      } catch (fetchError) {
        logEvent('json_fetch.failed', { url: redact(url), wgetError: wgetError.message, fetchError: fetchError.message })
        throw wgetError
      }
    } finally {
      jsonFetchInflight.delete(url)
    }
  })()
  jsonFetchInflight.set(url, promise)
  return promise
}

function resolveMetadataFromRequest(request) {
  const resolveRequest = request?.resolve
  if (!resolveRequest || typeof resolveRequest !== 'object') return null
  const metadata = {
    token: String(resolveRequest.token || ''),
    infoHash: resolveRequest.infoHash || null,
    fileIdx: resolveRequest.fileIdx ?? null,
    filename: resolveRequest.filename || request.filename || null,
    directUrl: resolveRequest.directUrl || null,
  }
  if (!metadata.infoHash && !metadata.directUrl) return null
  return metadata
}

async function refreshResolvedUrl(job) {
  if (!job?.resolve) return false
  appendJobLog(job, 'download.resolve_refresh.start', {
    infoHash: job.resolve.infoHash,
    fileIdx: job.resolve.fileIdx,
    filename: job.resolve.filename,
  })
  const refreshedUrl = await resolveTorboxStream(job.resolve)
  job.url = normalizeUrl(refreshedUrl)
  appendJobLog(job, 'download.resolve_refresh.ok', { url: redact(job.url) })
  logEvent('download.resolve_refresh.ok', { id: job.id })
  saveJobs()
  return true
}

async function statusForJob(job) {
  ensureJobLogPath(job)
  let changed = false
  const targetExists = existsSync(job.targetPath)
  const partialExists = existsSync(job.partialPath)
  let ariaStatus = null
  if (job.complete && targetExists) {
    job.state = 'complete'
    job.error = ''
    job.downloaded = statSync(job.targetPath).size
    job.size = job.downloaded
    cleanupDownloadArtifacts(job)
    void refreshConfiguredJellyfin(job)
    if (!job.aria2CleanedAt) {
      await ensureAria2Daemon()
        .then(() => removeAria2StatusesForPath(job.partialPath, () => true, 'complete_cleanup', job))
        .then(() => {
          job.aria2CleanedAt = new Date().toISOString()
          changed = true
        })
        .catch((error) => appendJobLog(job, 'download.aria2_complete_cleanup_failed', { error: error.message }))
    }
  } else if (job.gid) {
    try {
      await ensureAria2Daemon()
      ariaStatus = await aria2Rpc('tellStatus', [
        job.gid,
        ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'errorCode', 'errorMessage', 'files'],
      ])
      if (ariaStatus && !aria2StatusMatchesJob(ariaStatus, job)) {
        appendJobLog(job, 'download.aria2_stale_gid_removed', {
          gid: job.gid,
          expectedUrl: redact(job.url),
          actualUrls: aria2StatusUris(ariaStatus).map(redact).slice(0, 3),
        })
        logEvent('download.aria2_stale_gid_removed', { id: job.id, gid: job.gid })
        await removeAria2Gid(job.gid)
        delete job.gid
        changed = true
        ariaStatus = null
        job.state = 'queued'
        job.error = ''
        job.stalledSince = ''
        if (!job.staleRestartedAt || Date.now() - Date.parse(job.staleRestartedAt) > 60000) {
          job.staleRestartedAt = new Date().toISOString()
          try {
            await refreshResolvedUrl(job)
          } catch (error) {
            appendJobLog(job, 'download.resolve_refresh.failed', { error: error.message })
          }
          await startDownloadProcess(job)
          if (job.gid) {
            ariaStatus = await aria2Rpc('tellStatus', [
              job.gid,
              ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'errorCode', 'errorMessage', 'files'],
            ]).catch(() => null)
          }
        }
      }
    } catch (error) {
      appendJobLog(job, 'download.aria2_status_failed', { error: error.message })
      if (!job.complete && !job.error && /GID .+ is not found/i.test(error.message)) {
        delete job.gid
        ariaStatus = null
        job.state = 'queued'
        changed = true
        if (!job.staleRestartedAt || Date.now() - Date.parse(job.staleRestartedAt) > 60000) {
          job.staleRestartedAt = new Date().toISOString()
          try {
            await refreshResolvedUrl(job)
          } catch (refreshError) {
            appendJobLog(job, 'download.resolve_refresh.failed', { error: refreshError.message })
          }
          await startDownloadProcess(job)
          if (job.gid) {
            ariaStatus = await aria2Rpc('tellStatus', [
              job.gid,
              ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'errorCode', 'errorMessage', 'files'],
            ]).catch(() => null)
          }
        }
      }
    }
  }
  if (!job.complete && !job.error && job.partialPath && job.url) {
    const removedMismatched = await removeAria2StatusesForPath(
      job.partialPath,
      (status) => !aria2StatusMatchesJob(status, job),
      'mismatched_url',
      job,
    ).catch(() => 0)
    const removedDuplicates = job.gid
      ? await removeAria2StatusesForPath(
        job.partialPath,
        (status) => status.status === 'waiting' && status.gid !== job.gid && aria2StatusMatchesJob(status, job) && Number(status.completedLength || 0) <= 0,
        'duplicate_same_url',
        job,
      ).catch(() => 0)
      : 0
    if (removedMismatched || removedDuplicates) {
      changed = true
      ariaStatus = job.gid
        ? await aria2Rpc('tellStatus', [
          job.gid,
          ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'errorCode', 'errorMessage', 'files'],
        ]).catch(() => null)
        : null
    }
  }
  if (!job.complete && job.gid && (!ariaStatus || ariaStatus.status === 'error' || ariaStatus.status === 'removed')) {
    const activeStatus = await findAria2StatusForJob(job).catch(() => null)
    if (activeStatus && activeStatus.gid !== job.gid) {
      appendJobLog(job, 'download.aria2_gid_reconciled', { previousGid: job.gid, gid: activeStatus.gid })
      logEvent('download.aria2_gid_reconciled', { id: job.id, previousGid: job.gid, gid: activeStatus.gid })
      try {
        await aria2Rpc('removeDownloadResult', [job.gid])
      } catch {
        // Old gid may still be active in aria2's result list; harmless.
      }
      job.gid = activeStatus.gid
      ariaStatus = activeStatus
    }
  }
  const ariaState = ariaStatus?.status || ''
  const isActive = activeProcesses.has(job.id) || ariaState === 'active' || ariaState === 'waiting' || ariaState === 'paused'
  const now = Date.now()
  let downloaded = job.complete && targetExists ? statSync(job.targetPath).size : Number(ariaStatus?.completedLength || 0)
  if (!downloaded) {
    downloaded = targetExists
      ? statSync(job.targetPath).size
      : partialExists
        ? statSync(job.partialPath).size
        : job.downloaded || 0
  }
  const ariaSize = Number(ariaStatus?.totalLength || 0)
  if (ariaSize > 0) job.size = ariaSize
  if (job.complete && String(job.state || '').startsWith('error:') && targetExists) {
    job.state = 'complete'
    job.error = ''
  }
  if ((ariaState === 'active' || ariaState === 'waiting' || ariaState === 'paused') && job.error) {
    appendJobLog(job, 'download.error_cleared_by_active_telemetry', { previousError: job.error, ariaState })
    job.error = ''
    job.state = ariaState === 'waiting' ? 'queued' : ariaState === 'paused' ? 'paused' : 'downloading'
  }
  if (ariaState === 'error') {
    job.error = publicError(ariaStatus.errorMessage || `aria2 error ${ariaStatus.errorCode || ''}`.trim())
    job.state = `error:${job.error}`
    if (/Download aborted/i.test(job.error) && (!job.abortRestartedAt || now - Date.parse(job.abortRestartedAt) > 60000)) {
      appendJobLog(job, 'download.abort_retry', { gid: job.gid || '' })
      await removeAria2Gid(job.gid)
      delete job.gid
      job.abortRestartedAt = new Date(now).toISOString()
      job.error = ''
      job.state = 'queued'
      try {
        await refreshResolvedUrl(job)
      } catch (refreshError) {
        appendJobLog(job, 'download.resolve_refresh.failed', { error: refreshError.message })
      }
      await startDownloadProcess(job)
      ariaStatus = job.gid
        ? await aria2Rpc('tellStatus', [
          job.gid,
          ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'errorCode', 'errorMessage', 'files'],
        ]).catch(() => null)
        : null
      changed = true
    }
  }
  if (ariaState === 'complete' && !job.complete) {
    try {
      completeJob(job, 'aria2-rpc')
      downloaded = job.downloaded
    } catch (error) {
      job.error = error.message
      job.state = `error:${error.message}`
    }
  }
  if (targetExists && !job.complete) {
    completeJob(job, 'target-exists-reconcile')
    downloaded = job.downloaded
  }
  if (downloaded > 0 && (!job.size || job.size < downloaded) && (targetExists || job.complete)) {
    job.size = downloaded
  }
  if (isActive && job.size > 0 && downloaded > job.size) {
    appendJobLog(job, 'download.size_invalidated', { downloaded, previousSize: job.size })
    job.size = 0
  }
  if (!isActive && !job.error && !targetExists && partialExists && (job.size <= 0 || downloaded >= job.size)) {
    try {
      completeJob(job, 'status-reconcile')
      downloaded = job.downloaded
    } catch (error) {
      job.error = error.message
      job.state = `error:${error.message}`
    }
  }
  const elapsed = Math.max((now - (job.lastSeen || now)) / 1000, 1)
  const instantSpeed = Math.max(0, Math.round((downloaded - (job.lastDownloaded || 0)) / elapsed))
  job.samples = Array.isArray(job.samples) ? job.samples : []
  job.samples.push({ at: now, downloaded })
  job.samples = job.samples.filter((sample) => now - sample.at <= 15000)
  const firstSample = job.samples[0]
  const sampledElapsed = firstSample ? Math.max((now - firstSample.at) / 1000, 0.001) : elapsed
  const sampledBytes = firstSample ? Math.max(0, downloaded - firstSample.downloaded) : instantSpeed * elapsed
  const ariaSpeed = Number(ariaStatus?.downloadSpeed || 0)
  const speed = job.error || job.complete ? 0 : ariaSpeed > 0 ? ariaSpeed : Math.max(instantSpeed, Math.round(sampledBytes / sampledElapsed))
  job.lastSeen = now
  job.lastDownloaded = downloaded
  job.downloaded = downloaded
  if (job.size > 0 && downloaded >= job.size && targetExists) job.complete = true
  let progress = job.complete ? 1 : job.size > 0 ? Math.min(downloaded / job.size, 1) : downloaded > 0 ? 0.01 : 0
  if (isActive && !job.complete && progress >= 1) progress = 0.99
  const eta = speed > 0 && job.size > downloaded ? Math.round((job.size - downloaded) / speed) : -1
  const noBytesYet = isActive && !job.complete && !job.error && downloaded <= 0 && speed <= 0
  if (noBytesYet) {
    if (!job.stalledSince) job.stalledSince = new Date(now).toISOString()
  } else {
    job.stalledSince = ''
  }
  const stalledMs = job.stalledSince ? Math.max(0, now - Date.parse(job.stalledSince)) : 0
  const isStalled = noBytesYet && stalledMs >= 45000
  let statusMessage = ''
  let statusAction = ''
  if (isStalled) {
    statusMessage = 'No bytes have arrived from Torbox yet. The CDN link may be stalled, expired, or temporarily not serving this cached result.'
    statusAction = 'Cancel this row and try another result, or retry this result to request a fresh Torbox URL.'
    if (!job.stallLoggedAt || now - Date.parse(job.stallLoggedAt) > 60000) {
      job.stallLoggedAt = new Date(now).toISOString()
      appendJobLog(job, 'download.stalled_no_bytes', {
        gid: job.gid || '',
        ariaState,
        connections: Number(ariaStatus?.connections || 0),
        totalLength: Number(ariaStatus?.totalLength || 0),
        partialPath: job.partialPath,
      })
      logEvent('download.stalled_no_bytes', { id: job.id, gid: job.gid || '', ariaState })
    }
  } else if (noBytesYet) {
    statusMessage = 'Connected to the downloader and waiting for the first bytes from Torbox.'
  }
  if (changed) saveJobs()
  const state = job.error
    ? `error:${publicError(job.error)}`
    : job.complete
      ? 'complete'
      : isStalled
        ? 'stalled'
        : ariaState === 'paused'
          ? 'paused'
          : ariaState === 'waiting'
            ? 'queued'
            : isActive
              ? 'downloading'
              : job.state || 'queued'
  return {
    id: job.id,
    hash: null,
    name: basename(job.targetPath),
    progress,
    state,
    speed,
    eta,
    size: job.size || 0,
    downloaded,
    savePath: dirname(job.targetPath),
    targetPath: job.targetPath,
    partialPath: job.partialPath,
    statusPath: jobsFile,
    complete: Boolean(job.complete),
    createdAt: job.createdAt || '',
    engine: job.engine || '',
    logPath: job.logPath || '',
    connections: Number(ariaStatus?.connections || 0),
    gid: job.gid || '',
    jellyfinRefreshRequested: job.jellyfinRefreshRequested || '',
    jellyfinRefreshOk: job.jellyfinRefreshOk || '',
    jellyfinRefreshError: job.jellyfinRefreshError || '',
    jellyfinImportedAt: job.jellyfinImportedAt || '',
    jellyfinItemId: job.jellyfinItemId || '',
    jellyfinItemPath: job.jellyfinItemPath || '',
    jellyfinImportError: job.jellyfinImportError || '',
    statusMessage,
    statusAction,
    stalledSince: job.stalledSince || '',
  }
}

async function probeSize(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    const contentType = response.headers.get('content-type') || ''
    const length = Number(response.headers.get('content-length') || 0)
    if (Number.isFinite(length) && length > 1) return { size: length, contentType }
  } catch (error) {
    logEvent('download.probe.head_failed', { error: error.message, url: redact(url) })
  }
  const child = spawn('wget', ['--spider', '--server-response', '--max-redirect=20', url], { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  await new Promise((resolvePromise) => child.on('close', resolvePromise))
  const matches = [...stderr.matchAll(/Content-Length:\s*(\d+)/gi)]
  const contentTypes = [...stderr.matchAll(/Content-Type:\s*([^\r\n]+)/gi)]
  return {
    size: Number(matches.at(-1)?.[1] || 0),
    contentType: contentTypes.at(-1)?.[1]?.trim() || '',
  }
}

function validateDownloadProbe(probe, filename) {
  const contentType = String(probe.contentType || '').toLowerCase()
  const size = Number(probe.size || 0)
  if (contentType.startsWith('image/') || contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new Error(`Torbox returned ${probe.contentType || 'a non-video response'} instead of a media file. Pick another result or try again after Torbox finishes caching it.`)
  }
  if (isVideoFilename(filename) && size > 0 && size < 5_000_000) {
    throw new Error(`Torbox returned a tiny ${size} byte response for a video file. That usually means the selected Torbox file is artwork or an error page, not the movie.`)
  }
}

function shouldAutoResumeErroredJob(job) {
  if (!job.error) return true
  if (job.resolve) return true
  return !/Bad Gateway|ERROR\s+[45]\d\d|wget exited 8/i.test(job.error)
}

async function startLocalDownload(request) {
  const url = normalizeUrl(request.url)
  const id = request.id || `local-${Date.now()}`
  const existing = jobs[id]
  if (existing && !existing.complete && !existing.error) {
    logEvent('download.duplicate_reused', { id })
    return await statusForJob(existing)
  }
  const targetPath = safeTargetPath(request.savePath || defaultDownloadDir, request.folderName, request.filename)
  const partialPath = `${targetPath}.part`
  const probe = await probeSize(url).catch((error) => {
    logEvent('download.probe.failed', { id, error: error.message, url: redact(url) })
    return { size: 0, contentType: '' }
  })
  validateDownloadProbe(probe, request.filename)
  const size = probe.size
  const logPath = join(downloadLogDir, `${sanitizeFilename(id, 'download')}.log`)
  const job = {
    id,
    url,
    resolve: resolveMetadataFromRequest(request),
    targetPath,
    partialPath,
    size,
    contentType: probe.contentType,
    downloaded: 0,
    lastDownloaded: 0,
    lastSeen: Date.now(),
    complete: false,
    error: '',
    state: 'downloading',
    engine: '',
    samples: [],
    logPath,
    createdAt: new Date().toISOString(),
    refreshJellyfinOnComplete: request.refreshJellyfinOnComplete !== false,
    jellyfinUrl: String(request.jellyfinUrl || '').trim(),
    jellyfinApiKey: String(request.jellyfinApiKey || '').trim(),
  }
  ensureJobLogPath(job)
  jobs[id] = job
  saveJobs()
  appendJobLog(job, 'download.created', {
    id,
    url: redact(url),
    targetPath,
    partialPath,
    size,
    contentType: probe.contentType,
  })
  logEvent('download.created', { id, targetPath, size, contentType: probe.contentType })

  await startDownloadProcess(job)
  return await statusForJob(job)
}

async function startDownloadProcess(job) {
  ensureJobLogPath(job)
  const orphanedPartial = existsSync(job.partialPath) && !existsSync(`${job.partialPath}.aria2`) && !existsSync(job.targetPath)
  const useAria2 = !orphanedPartial && (await ensureAria2Daemon())
  const command = useAria2 ? 'aria2c' : 'wget'
  if (orphanedPartial) {
    delete job.gid
    appendJobLog(job, 'download.legacy_partial_fallback', {
      partialPath: job.partialPath,
      reason: 'aria2 needs a .aria2 control file to safely resume segmented partials',
    })
    logEvent('download.legacy_partial_fallback', { id: job.id })
  }
  if (useAria2) {
    const existingStatus = await findAria2StatusForJob(job).catch(() => null)
    if (existingStatus?.gid && (existingStatus.status === 'active' || existingStatus.status === 'waiting' || existingStatus.status === 'paused')) {
      job.gid = existingStatus.gid
      job.engine = 'aria2c'
      job.state = existingStatus.status === 'waiting' ? 'queued' : existingStatus.status === 'paused' ? 'paused' : 'downloading'
      job.error = ''
      job.lastSeen = Date.now()
      job.lastDownloaded = Number(existingStatus.completedLength || job.downloaded || 0)
      saveJobs()
      appendJobLog(job, 'download.aria2_existing_reused', { gid: job.gid, ariaState: existingStatus.status })
      logEvent('download.aria2_existing_reused', { id: job.id, gid: job.gid, ariaState: existingStatus.status })
      return
    }
    const gid = await aria2Rpc('addUri', [
      [job.url],
      {
        dir: dirname(job.partialPath),
        out: basename(job.partialPath),
        continue: 'true',
        'auto-file-renaming': 'false',
        'allow-overwrite': 'true',
        'file-allocation': 'none',
        split: aria2Split,
        'max-connection-per-server': aria2Connections,
        'min-split-size': aria2MinSplitSize,
      },
    ])
    job.gid = gid
    job.engine = 'aria2c'
    job.state = 'downloading'
    job.error = ''
    job.lastSeen = Date.now()
    job.lastDownloaded = job.downloaded || 0
    job.samples = []
    saveJobs()
    appendJobLog(job, 'download.aria2_rpc.start', { gid, url: redact(job.url) })
    logEvent('download.aria2_rpc.start', { id: job.id, gid })
    return
  }
  const args = useAria2
    ? [
        '--continue=true',
        '--auto-file-renaming=false',
        '--allow-overwrite=true',
        '--file-allocation=none',
        `--split=${aria2Split}`,
        `--max-connection-per-server=${aria2Connections}`,
        `--min-split-size=${aria2MinSplitSize}`,
        '--retry-wait=5',
        '--max-tries=0',
        '--timeout=60',
        '--connect-timeout=30',
        '--summary-interval=1',
        '--console-log-level=warn',
        '--download-result=hide',
        '-d',
        dirname(job.partialPath),
        '-o',
        basename(job.partialPath),
        job.url,
      ]
    : ['--show-progress', '--progress=dot:giga', '-c', '-O', job.partialPath, job.url]
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  job.engine = command
  job.state = 'downloading'
  job.error = ''
  job.lastSeen = Date.now()
  job.lastDownloaded = job.downloaded || 0
  job.samples = []
  saveJobs()
  activeProcesses.set(job.id, child)
  appendJobLog(job, 'download.process.start', {
    command,
    args: args.map((arg) => (arg === job.url ? redact(arg) : arg)),
  })
  let processOutput = ''
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    processOutput = `${processOutput}${text}`.slice(-4000)
    appendJobLog(job, 'download.process.stdout', { text: text.slice(0, 1000) })
  })
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    processOutput = `${processOutput}${text}`.slice(-4000)
    appendJobLog(job, 'download.process.stderr', { text: text.slice(0, 1000) })
  })
  child.on('close', (code) => {
    activeProcesses.delete(job.id)
    if (job.cancelled) {
      appendJobLog(job, 'download.cancelled', { code })
      logEvent('download.cancelled', { id: job.id, code, engine: job.engine })
      saveJobs()
      return
    }
    if (code === 0) {
      try {
        completeJob(job, 'process-close')
      } catch (error) {
        job.error = error.message
        job.state = `error:${error.message}`
        appendJobLog(job, 'download.finalize_failed', { error: error.message })
        logEvent('download.finalize_failed', { id: job.id, error: error.message })
      }
    } else {
      job.error = publicError(`${command} exited ${code}: ${processOutput.trim()}`)
      job.state = `error:${job.error}`
      appendJobLog(job, 'download.failed', { code, output: publicError(processOutput.trim()) })
      logEvent('download.failed', { id: job.id, code, engine: job.engine, output: publicError(processOutput.trim()).slice(-1000) })
    }
    saveJobs()
  })
  child.on('error', (error) => {
    activeProcesses.delete(job.id)
    job.error = error.message
    job.state = `error:${error.message}`
    appendJobLog(job, 'download.spawn_failed', { error: error.message })
    logEvent('download.spawn_failed', { id: job.id, error: error.message })
    saveJobs()
  })
}

async function resumeIncompleteDownloads() {
  for (const job of Object.values(jobs)) {
    ensureJobLogPath(job)
    if (!job || job.complete || activeProcesses.has(job.id)) continue
    if (job.error && !existsSync(job.partialPath)) continue
    if (job.error && !shouldAutoResumeErroredJob(job)) {
      appendJobLog(job, 'download.resume_skipped', { reason: 'previous non-retryable error', error: publicError(job.error) })
      logEvent('download.resume_skipped', { id: job.id, reason: 'previous non-retryable error' })
      continue
    }
    if (job.error && existsSync(job.partialPath)) {
      logEvent('download.resume_after_error', { id: job.id, previousError: job.error })
      job.error = ''
      job.state = 'queued'
    }
    if (existsSync(job.targetPath)) {
      completeJob(job, 'resume-existing-target')
      continue
    }
    try {
      await refreshResolvedUrl(job)
    } catch (error) {
      job.error = `Could not refresh Torbox URL for resume: ${error.message}`
      job.state = `error:${job.error}`
      appendJobLog(job, 'download.resolve_refresh.failed', { error: error.message })
      logEvent('download.resolve_refresh.failed', { id: job.id, error: error.message })
      continue
    }
    await startDownloadProcess(job)
  }
  saveJobs()
}

async function pauseDownload(id) {
  const job = jobs[id]
  if (!job || job.complete) return { ok: false }
  if (job.gid) {
    await ensureAria2Daemon()
    await aria2Rpc('pause', [job.gid])
  }
  const process = activeProcesses.get(id)
  if (process) process.kill('SIGSTOP')
  job.paused = true
  job.state = 'paused'
  saveJobs()
  appendJobLog(job, 'download.paused', { gid: job.gid || '' })
  logEvent('download.paused', { id })
  return { ok: true }
}

async function resumeDownload(id) {
  const job = jobs[id]
  if (!job || job.complete) return { ok: false }
  if (job.gid) {
    await ensureAria2Daemon()
    await aria2Rpc('unpause', [job.gid])
  }
  const process = activeProcesses.get(id)
  if (process) process.kill('SIGCONT')
  job.paused = false
  job.state = job.gid ? 'downloading' : 'downloading'
  saveJobs()
  appendJobLog(job, 'download.resumed', { gid: job.gid || '' })
  logEvent('download.resumed', { id })
  return { ok: true }
}

async function deleteDownload(id) {
  const job = jobs[id]
  if (!job) return { ok: true }
  if (job.gid) {
    try {
      await ensureAria2Daemon()
      await aria2Rpc('remove', [job.gid])
    } catch {
      try {
        await aria2Rpc('removeDownloadResult', [job.gid])
      } catch {
        // The gid may already be gone after completion or restart.
      }
    }
  }
  const process = activeProcesses.get(id)
  if (process) {
    job.cancelled = true
    process.kill('SIGTERM')
    activeProcesses.delete(id)
  }
  if (!job.complete) {
    try {
      if (existsSync(job.partialPath)) await rmFile(job.partialPath)
    } catch (error) {
      appendJobLog(job, 'download.partial_delete_failed', { error: error.message })
    }
  }
  appendJobLog(job, 'download.deleted', { complete: Boolean(job.complete) })
  logEvent('download.deleted', { id, complete: Boolean(job.complete) })
  delete jobs[id]
  saveJobs()
  return { ok: true }
}

function rmFile(path) {
  return new Promise((resolvePromise, reject) => {
    spawn('rm', ['-f', path]).on('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`rm exited ${code}`))
    }).on('error', reject)
  })
}

function jellyfinPathForJob(job) {
  return jellyfinPathForJobFromModule(job, { pathMapFrom: jellyfinPathMapFrom, pathMapTo: jellyfinPathMapTo })
}

async function waitForJellyfinImport(job, config) {
  return waitForJellyfinImportFromModule(
    job,
    { ...config, pathMapFrom: jellyfinPathMapFrom, pathMapTo: jellyfinPathMapTo },
    { sleep, appendJobLog },
  )
}

async function refreshConfiguredJellyfin(job) {
  if (job.refreshJellyfinOnComplete === false) {
    appendJobLog(job, 'jellyfin.refresh.skipped', { reason: 'disabled for this download' })
    return
  }
  const baseUrl = String(job.jellyfinUrl || defaultJellyfinUrl || '').trim()
  const apiKey = String(job.jellyfinApiKey || defaultJellyfinApiKey || '').trim()
  if (!baseUrl || !apiKey) {
    appendJobLog(job, 'jellyfin.refresh.skipped', { reason: 'missing server Jellyfin config' })
    return
  }
  if (job.jellyfinRefreshRequested) {
    const lastChecked = job.jellyfinImportCheckedAt ? Date.parse(job.jellyfinImportCheckedAt) : 0
    if (!job.jellyfinImportedAt && (!lastChecked || Date.now() - lastChecked > 60000)) {
      const item = await waitForJellyfinImport(job, { baseUrl, apiKey })
      job.jellyfinImportCheckedAt = new Date().toISOString()
      if (item) {
        job.jellyfinImportedAt = new Date().toISOString()
        job.jellyfinItemId = item.Id || ''
        job.jellyfinItemPath = item.Path || ''
        job.jellyfinImportError = ''
        appendJobLog(job, 'jellyfin.import.ok', { itemId: job.jellyfinItemId, path: job.jellyfinItemPath })
      } else {
        job.jellyfinImportError = `Jellyfin scan finished but the file was not found at ${jellyfinPathForJob(job)} yet.`
        appendJobLog(job, 'jellyfin.import.not_found', { path: jellyfinPathForJob(job) })
      }
      saveJobs()
    }
    return
  }
  job.jellyfinRefreshRequested = new Date().toISOString()
  saveJobs()
  try {
    await refreshJellyfin({ baseUrl, apiKey })
    job.jellyfinRefreshOk = new Date().toISOString()
    appendJobLog(job, 'jellyfin.refresh.ok', { baseUrl })
    logEvent('jellyfin.refresh.ok', { id: job.id })
    const item = await waitForJellyfinImport(job, { baseUrl, apiKey })
    if (item) {
      job.jellyfinImportedAt = new Date().toISOString()
      job.jellyfinItemId = item.Id || ''
      job.jellyfinItemPath = item.Path || ''
      job.jellyfinImportError = ''
      appendJobLog(job, 'jellyfin.import.ok', { itemId: job.jellyfinItemId, path: job.jellyfinItemPath })
      logEvent('jellyfin.import.ok', { id: job.id, itemId: job.jellyfinItemId })
    } else {
      job.jellyfinImportError = `Jellyfin scan finished but the file was not found at ${jellyfinPathForJob(job)} yet.`
      appendJobLog(job, 'jellyfin.import.not_found', { path: jellyfinPathForJob(job) })
      logEvent('jellyfin.import.not_found', { id: job.id })
    }
  } catch (error) {
    job.jellyfinRefreshError = error.message
    appendJobLog(job, 'jellyfin.refresh.failed', { error: error.message, baseUrl })
    logEvent('jellyfin.refresh.failed', { id: job.id, error: error.message })
  } finally {
    saveJobs()
  }
}

async function handleApi(request, response, pathname) {
  const body = request.method === 'GET' ? {} : await readJson(request)
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      active: activeProcesses.size + Object.values(jobs).filter((job) => job.gid && !job.complete && !job.error).length,
      jobs: Object.keys(jobs).length,
      aria2c: commandExists('aria2c'),
      wget: commandExists('wget'),
      ffmpeg: isFfmpegAvailable(),
      downloadDir: defaultDownloadDir,
      errorsLog: errorsLogFile,
    })
    return
  }
  if (pathname === '/api/client-errors' && request.method === 'POST') {
    const report = body?.message ? body : {}
    if (!report.message) {
      sendError(response, 400, 'message is required')
      return
    }
    logError('client', {
      message: report.message,
      name: report.name || 'Error',
      stack: report.stack || '',
    }, {
      kind: report.kind || 'client',
      url: report.url || '',
      userAgent: report.userAgent || String(request.headers['user-agent'] || ''),
      componentStack: report.componentStack || '',
      context: report.context || {},
    })
    sendJson(response, 204, {})
    return
  }
  if (pathname === '/api/fetch-json' && request.method === 'GET') {
    const targetUrl = normalizeAllowedFetchJsonUrl(requestUrl.searchParams.get('url'))
    sendJson(response, 200, await fetchCachedJson(targetUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Torfin/1.0.0-beta',
      },
    }))
    return
  }
  if (pathname === '/api/resolve-torbox-stream') {
    sendJson(response, 200, { url: await resolveTorboxStream(body) })
    return
  }
  if (pathname === '/api/inspect-media' && request.method === 'POST') {
    sendJson(response, 200, await probeMedia(body.url))
    return
  }
  if (pathname === '/api/start-hls-transcode' && request.method === 'POST') {
    const startSeconds = Math.max(0, Number(body.startSeconds) || 0)
    const result = await startHlsTranscode(
      body.url,
      body.audioStreamIndex ?? null,
      body.subtitleStreamIndex ?? null,
      startSeconds,
    )
    sendJson(response, 200, result)
    return
  }
  const seekMatch = pathname.match(/^\/api\/hls-transcode\/([^/]+)\/seek$/)
  if (seekMatch && request.method === 'POST') {
    const result = await seekHlsTranscode(seekMatch[1], body.time)
    sendJson(response, 200, result)
    return
  }
  if (pathname === '/api/hls-transcode-progress' && request.method === 'GET') {
    sendJson(response, 200, getHlsTranscodeProgress())
    return
  }
  if (pathname.startsWith('/api/hls-transcode/') && request.method === 'GET') {
    if (await serveHlsTranscodeFile(pathname, response)) return
    sendError(response, 404, 'Transcode session not found')
    return
  }
  if (pathname === '/api/downloads' && request.method === 'GET') {
    const statuses = await Promise.all(Object.values(jobs).map((job) => statusForJob(job)))
    const seenCompleteTargets = new Set()
    sendJson(response, 200, statuses.filter((status) => {
      if (!status.complete || !status.targetPath) return true
      const key = status.targetPath
      if (seenCompleteTargets.has(key)) return false
      seenCompleteTargets.add(key)
      return true
    }))
    saveJobs()
    return
  }
  if (pathname === '/api/downloads' && request.method === 'POST') {
    sendJson(response, 200, await startLocalDownload(body))
    return
  }
  if (pathname.startsWith('/api/downloads/') && pathname.endsWith('/log') && request.method === 'GET') {
    const id = decodeURIComponent(pathname.split('/').at(-2) || '')
    const job = jobs[id]
    if (!job?.logPath || !existsSync(job.logPath)) throw new Error('No log is available for this download.')
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    createReadStream(job.logPath).pipe(response)
    return
  }
  if (pathname.startsWith('/api/downloads/') && pathname.endsWith('/pause') && request.method === 'POST') {
    const id = decodeURIComponent(pathname.split('/').at(-2) || '')
    sendJson(response, 200, await pauseDownload(id))
    return
  }
  if (pathname.startsWith('/api/downloads/') && pathname.endsWith('/resume') && request.method === 'POST') {
    const id = decodeURIComponent(pathname.split('/').at(-2) || '')
    sendJson(response, 200, await resumeDownload(id))
    return
  }
  if (pathname.startsWith('/api/downloads/') && request.method === 'DELETE') {
    const id = decodeURIComponent(pathname.split('/').pop() || '')
    sendJson(response, 200, await deleteDownload(id))
    return
  }
  if (pathname.startsWith('/api/downloads/') && request.method === 'GET') {
    const id = decodeURIComponent(pathname.split('/').pop() || '')
    const job = jobs[id]
    if (!job) throw new Error('This download is not being tracked.')
    sendJson(response, 200, await statusForJob(job))
    saveJobs()
    return
  }
  if (pathname === '/api/jellyfin/refresh') {
    await refreshJellyfin(body)
    sendJson(response, 200, { ok: true })
    return
  }
  if (pathname === '/api/jellyfin/verify-import') {
    sendJson(response, 200, await verifyJellyfinImport(body))
    return
  }
  if (pathname === '/api/jellyfin/test') {
    const base = String(body.baseUrl || '').replace(/\/+$/, '')
    const info = await fetchJson(`${base}/System/Info`, { headers: { 'X-Emby-Token': String(body.apiKey || '').trim() } })
    sendJson(response, 200, { name: info.ServerName || 'Jellyfin', version: info.Version || 'unknown' })
    return
  }
  if (pathname === '/api/jellyfin/auth') {
    const base = String(body.baseUrl || '').replace(/\/+$/, '')
    const auth = await fetchJson(`${base}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'MediaBrowser Client="Torfin", Device="Web", DeviceId="torfin-web", Version="1.0.0-beta"',
      },
      body: JSON.stringify({ Username: body.username, Pw: body.password }),
    })
    sendJson(response, 200, { token: auth.AccessToken })
    return
  }
  if (pathname === '/api/jellyfin/lookup') {
    sendJson(response, 200, await lookupJellyfinLibrary(body))
    return
  }
  if (pathname === '/api/jellyfin/batch-lookup') {
    sendJson(response, 200, await batchLookupJellyfinLibrary(body))
    return
  }
  if (pathname === '/api/jellyfin/season-episodes') {
    sendJson(response, 200, await lookupJellyfinSeasonEpisodes(body))
    return
  }
  if (pathname === '/api/jellyfin/favorites') {
    sendJson(response, 200, await fetchJellyfinFavorites(body))
    return
  }
  if (pathname === '/api/torbox/account') {
    sendJson(response, 200, await fetchTorboxAccount(body.apiKey))
    return
  }
  sendError(response, 404, 'Not found')
}

function serveStatic(request, response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname
  const filePath = normalize(join(distDir, requested))
  if (!filePath.startsWith(distDir)) {
    sendError(response, 403, 'Forbidden')
    return
  }
  const path = existsSync(filePath) ? filePath : join(distDir, 'index.html')
  const type = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  }[extname(path)] || 'application/octet-stream'
  response.writeHead(200, { 'content-type': type })
  createReadStream(path).pipe(response)
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (url.pathname.startsWith('/api/')) {
    if (!isAuthorizedApiRequest(request, url.pathname)) {
      sendError(response, 401, 'Unauthorized')
      return
    }
    handleApi(request, response, url.pathname).catch((error) => {
      logEvent('api.error', {
        method: request.method,
        path: url.pathname,
        error: error.message || String(error),
      })
      logError('server', error, {
        kind: 'api',
        method: request.method,
        path: url.pathname,
      })
      sendError(response, 500, error.message || String(error))
    })
    return
  }
  if (isDevelopment) {
    sendError(
      response,
      404,
      'Torfin API only in dev. Open http://localhost:5173 for the app UI.',
    )
    return
  }
  serveStatic(request, response, url.pathname)
})

let shutdownStarted = false
async function shutdownGracefully(signal) {
  if (shutdownStarted) return
  shutdownStarted = true
  logEvent('server.shutdown.start', { signal })
  try {
    saveJobs()
  } catch (error) {
    logEvent('server.shutdown.save_jobs_failed', { error: error.message })
  }

  if (aria2Daemon) {
    try {
      await aria2Rpc('saveSession')
      logEvent('aria2.session_saved', { signal })
    } catch (error) {
      logEvent('aria2.save_session_failed', { error: error.message })
    }
    try {
      await aria2Rpc('shutdown')
      logEvent('aria2.shutdown_requested', { signal })
    } catch (error) {
      logEvent('aria2.shutdown_failed', { error: error.message })
    }
  }

  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.once('SIGTERM', () => {
  void shutdownGracefully('SIGTERM')
})
process.once('SIGINT', () => {
  void shutdownGracefully('SIGINT')
})

async function prewarmJsonCache() {
  for (const url of prewarmJsonUrls) {
    try {
      await fetchCachedJson(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'Torfin/1.0.0-beta',
        },
      })
      logEvent('json_fetch.prewarm_ok', { url: redact(url) })
    } catch (error) {
      logEvent('json_fetch.prewarm_failed', { url: redact(url), error: error.message })
    }
  }
}

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process or set PORT to a free port.`)
    process.exit(1)
  }
  console.error('Server failed to start:', error.message || String(error))
  process.exit(1)
})

server.listen(port, isDevelopment ? '127.0.0.1' : '0.0.0.0', () => {
  void resumeIncompleteDownloads()
  void prewarmJsonCache()
  if (isDevelopment) {
    console.log(`Torfin API (dev) on http://127.0.0.1:${port} — UI at http://localhost:5173`)
    return
  }
  console.log(`Torfin web listening on ${port}`)
})
