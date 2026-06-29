import { isTauriRuntime, postApi } from './api'
import { DEFAULT_LOCAL_DOWNLOAD_PATH, DOCKER_DOWNLOAD_PATH, isLegacyDockerDownloadPath, syncLocalDestinationWithServer } from './paths'
import { getSecret, setSecret } from './secrets'
import type { DownloadConfig, DownloadDestination, DownloadDestinationKind, Movie } from '../types'

export { syncLocalDestinationWithServer }

export type DestinationSecrets = {
  sshPassword: string
}

export type DestinationTestResult = {
  ok: boolean
  message: string
}

export function destinationSshSecretKey(id: string) {
  return `dest_ssh_${id}`
}

export function destinationJellyfinSecretKey(id: string) {
  return `dest_jellyfin_${id}`
}

export function createDestinationId() {
  return `dest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultLocalDestinationName(isDesktop: boolean) {
  return isDesktop ? 'This Mac' : 'This Server'
}

export function defaultRemoteDestinationName() {
  return 'Remote Server'
}

export function newDestination(kind: DownloadDestinationKind, isDesktop: boolean): DownloadDestination {
  return {
    id: createDestinationId(),
    name: kind === 'local' ? defaultLocalDestinationName(isDesktop) : defaultRemoteDestinationName(),
    kind,
    isDefault: false,
    moviesPath: kind === 'local' ? DEFAULT_LOCAL_DOWNLOAD_PATH : '',
    tvPath: '',
    sshHost: '',
    sshPort: 22,
    sshUsername: '',
  }
}

type LegacyDestinationKind = DownloadDestinationKind | 'remote-jellyfin'

type LegacyDestination = Omit<DownloadDestination, 'kind'> & {
  jellyfinUrl?: string
  refreshOnComplete?: boolean
  kind: LegacyDestinationKind
}

function normalizeDestinationKind(kind: LegacyDestinationKind): DownloadDestinationKind {
  return kind === 'remote-jellyfin' ? 'remote' : kind
}

function normalizeDestination(entry: LegacyDestination): DownloadDestination {
  return {
    id: entry.id,
    name: entry.name,
    kind: normalizeDestinationKind(entry.kind),
    isDefault: entry.isDefault,
    moviesPath: entry.moviesPath,
    tvPath: entry.tvPath,
    sshHost: entry.sshHost,
    sshPort: entry.sshPort || 22,
    sshUsername: entry.sshUsername,
    lastTestedAt: entry.lastTestedAt,
    lastTestOk: entry.lastTestOk,
    lastTestMessage: entry.lastTestMessage,
  }
}

function mergeLegacyJellyfinFromDestinations(config: DownloadConfig): DownloadConfig {
  let jellyfinUrl = config.jellyfinUrl
  let refreshJellyfinOnComplete = config.refreshJellyfinOnComplete
  const destinations = (config.destinations || []).map((entry) => {
    const legacy = entry as LegacyDestination
    if (!jellyfinUrl.trim() && legacy.jellyfinUrl?.trim()) {
      jellyfinUrl = legacy.jellyfinUrl
    }
    if (legacy.refreshOnComplete) {
      refreshJellyfinOnComplete = true
    }
    return normalizeDestination(legacy)
  })
  return { ...config, jellyfinUrl, refreshJellyfinOnComplete, destinations }
}

function repairLegacyLocalPaths(config: DownloadConfig, isDesktop: boolean): DownloadConfig {
  const destinations = config.destinations.map((entry) => {
    if (entry.kind !== 'local') return entry
    if (!entry.moviesPath.trim()) {
      return { ...entry, moviesPath: DEFAULT_LOCAL_DOWNLOAD_PATH }
    }
    if (isDesktop && isLegacyDockerDownloadPath(entry.moviesPath)) {
      return { ...entry, moviesPath: DEFAULT_LOCAL_DOWNLOAD_PATH }
    }
    return entry
  })
  return normalizeDestinations({ ...config, destinations })
}

export function migrateDownloadConfig(config: DownloadConfig, isDesktop: boolean): DownloadConfig {
  if (config.destinations?.length) {
    return repairLegacyLocalPaths(mergeLegacyJellyfinFromDestinations(config), isDesktop)
  }

  const hasLegacyRemote = Boolean(config.sshHost.trim() && config.sshSavePath.trim())
  const hasLegacyLocal = Boolean(config.localSavePath.trim() || config.downloader === 'local')
  const destinations: DownloadDestination[] = []

  if (hasLegacyRemote || config.downloader === 'ssh') {
    destinations.push({
      id: createDestinationId(),
      name: defaultRemoteDestinationName(),
      kind: 'remote',
      isDefault: config.downloader === 'ssh' || hasLegacyRemote,
      moviesPath: config.sshSavePath || config.savePath || DOCKER_DOWNLOAD_PATH,
      tvPath: config.tvSavePath || '',
      sshHost: config.sshHost || '',
      sshPort: 22,
      sshUsername: config.sshUsername || '',
    })
  }

  if (hasLegacyLocal && (!isDesktop || config.downloader === 'local')) {
    destinations.push({
      id: createDestinationId(),
      name: defaultLocalDestinationName(isDesktop),
      kind: 'local',
      isDefault: config.downloader === 'local' || !hasLegacyRemote,
      moviesPath: config.localSavePath || DEFAULT_LOCAL_DOWNLOAD_PATH,
      tvPath: config.tvSavePath || '',
      sshHost: '',
      sshPort: 22,
      sshUsername: '',
    })
  }

  if (!destinations.length) {
    destinations.push({
      ...newDestination(isDesktop ? 'remote' : 'local', isDesktop),
      isDefault: true,
      moviesPath: isDesktop ? '' : DOCKER_DOWNLOAD_PATH,
    })
  }

  if (!destinations.some((entry) => entry.isDefault)) {
    destinations[0] = { ...destinations[0], isDefault: true }
  }

  const active = destinations.find((entry) => entry.isDefault) ?? destinations[0]

  const migrated = normalizeDestinations({
    ...config,
    jellyfinUrl: config.jellyfinUrl,
    refreshJellyfinOnComplete: config.refreshJellyfinOnComplete,
    destinations,
    activeDestinationId: active.id,
  })

  return repairLegacyLocalPaths(migrated, isDesktop)
}

function normalizeDestinations(config: DownloadConfig): DownloadConfig {
  const destinations = (config.destinations || []).map((entry) => normalizeDestination(entry as LegacyDestination))
  const activeDestinationId =
    destinations.find((entry) => entry.id === config.activeDestinationId)?.id
    ?? destinations.find((entry) => entry.isDefault)?.id
    ?? destinations[0]?.id
    ?? ''
  return { ...config, destinations, activeDestinationId }
}

export function getDestination(config: DownloadConfig, id?: string) {
  const targetId = id || config.activeDestinationId
  return config.destinations.find((entry) => entry.id === targetId) ?? config.destinations.find((entry) => entry.isDefault) ?? config.destinations[0]
}

export function getDefaultDestination(config: DownloadConfig) {
  return config.destinations.find((entry) => entry.isDefault) ?? config.destinations[0]
}

export function destinationIsConfigured(destination: DownloadDestination | undefined) {
  if (!destination) return false
  if (!destination.moviesPath.trim()) return false
  if (destination.kind === 'local') return true
  return Boolean(destination.sshHost.trim() && destination.sshUsername.trim())
}

export function destinationIsReady(destination: DownloadDestination | undefined, isDesktop: boolean) {
  if (!destinationIsConfigured(destination)) return false
  if (destination!.kind === 'local') return true
  return isDesktop
}

export function destinationSummary(destination: DownloadDestination) {
  if (destination.kind === 'local') {
    return `Local · ${destination.moviesPath}`
  }
  const host = destination.sshHost || 'remote server'
  return `SSH · ${host} · ${destination.moviesPath}`
}

export function destinationKindLabel(destination: DownloadDestination, isDesktop: boolean) {
  if (destination.kind === 'local') return isDesktop ? 'This device' : 'This server'
  return 'Remote (SSH)'
}

export async function loadDestinationSecrets(destination: DownloadDestination): Promise<DestinationSecrets> {
  const sshPassword = await getSecret(destinationSshSecretKey(destination.id))
  return { sshPassword: sshPassword || '' }
}

export async function saveDestinationSecrets(destinationId: string, secrets: Partial<DestinationSecrets>) {
  if (secrets.sshPassword !== undefined) {
    await setSecret(destinationSshSecretKey(destinationId), secrets.sshPassword)
  }
}

export async function migrateLegacySecrets(
  config: DownloadConfig,
  legacy: { jellyfinApiKey: string; sshPassword: string },
  onGlobalJellyfinKey?: (key: string) => void,
) {
  const globalJellyfin = legacy.jellyfinApiKey || (await getSecret('jellyfin_api_key')) || ''
  if (!globalJellyfin.trim()) {
    for (const destination of config.destinations) {
      const perDest = await getSecret(destinationJellyfinSecretKey(destination.id))
      if (perDest?.trim()) {
        onGlobalJellyfinKey?.(perDest)
        await setSecret('jellyfin_api_key', perDest)
        break
      }
    }
  }

  const defaultDest = getDefaultDestination(config)
  if (!defaultDest) return
  const existing = await loadDestinationSecrets(defaultDest)
  await saveDestinationSecrets(defaultDest.id, {
    sshPassword: existing.sshPassword || legacy.sshPassword,
  })
}

export function destinationRootForMovie(destination: DownloadDestination, movie: Movie) {
  if (movie.type === 'series' && destination.tvPath.trim()) return destination.tvPath.trim()
  return destination.moviesPath.trim()
}

export function destinationToLegacyConfig(
  config: DownloadConfig,
  destination: DownloadDestination,
  secrets: DestinationSecrets,
  jellyfinApiKey: string,
): DownloadConfig {
  const isRemote = destination.kind === 'remote'
  return {
    ...config,
    activeDestinationId: destination.id,
    jellyfinApiKey,
    downloader: isRemote ? 'ssh' : config.downloader === 'qbittorrent' ? 'qbittorrent' : 'local',
    localSavePath: destination.kind === 'local' ? destination.moviesPath : config.localSavePath,
    tvSavePath: destination.tvPath,
    sshHost: destination.sshHost,
    sshUsername: destination.sshUsername,
    sshPassword: secrets.sshPassword,
    sshSavePath: isRemote ? destination.moviesPath : config.sshSavePath,
  }
}

export function setDefaultDestination(config: DownloadConfig, id: string): DownloadConfig {
  return normalizeDestinations({
    ...config,
    activeDestinationId: id,
    destinations: config.destinations.map((entry) => ({ ...entry, isDefault: entry.id === id })),
  })
}

export function upsertDestination(config: DownloadConfig, destination: DownloadDestination, makeDefault = false): DownloadConfig {
  const exists = config.destinations.some((entry) => entry.id === destination.id)
  let destinations = exists
    ? config.destinations.map((entry) => (entry.id === destination.id ? destination : entry))
    : [...config.destinations, destination]
  if (makeDefault || destination.isDefault) {
    destinations = destinations.map((entry) => ({ ...entry, isDefault: entry.id === destination.id }))
  }
  return normalizeDestinations({
    ...config,
    destinations,
    activeDestinationId: makeDefault || destination.isDefault ? destination.id : config.activeDestinationId,
  })
}

export function removeDestination(config: DownloadConfig, id: string): DownloadConfig {
  const destinations = config.destinations.filter((entry) => entry.id !== id)
  if (!destinations.length) return config
  if (!destinations.some((entry) => entry.isDefault)) {
    destinations[0] = { ...destinations[0], isDefault: true }
  }
  return normalizeDestinations({
    ...config,
    destinations,
    activeDestinationId: config.activeDestinationId === id ? (destinations.find((entry) => entry.isDefault)?.id ?? '') : config.activeDestinationId,
  })
}

export async function testJellyfinConnection(baseUrl: string, apiKey: string) {
  if (!baseUrl.trim()) throw new Error('Enter your Jellyfin server URL.')
  if (!apiKey.trim()) throw new Error('Enter a Jellyfin API key or sign in.')
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<{ name: string; version: string }>('test_jellyfin', { baseUrl, apiKey })
  }
  return postApi<{ name: string; version: string }>('/api/jellyfin/test', { baseUrl, apiKey })
}

export async function testSshConnection(destination: DownloadDestination, sshPassword: string) {
  if (!destination.sshHost.trim()) throw new Error('Enter the SSH host.')
  if (!destination.sshUsername.trim()) throw new Error('Enter the SSH username.')
  if (!destination.moviesPath.trim()) throw new Error('Enter the remote movies folder.')
  if (!isTauriRuntime()) throw new Error('SSH downloads are only available in the desktop app.')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<{ writable: boolean; hasWget: boolean; message: string }>('test_ssh_connection', {
    host: destination.sshHost,
    port: destination.sshPort || 22,
    username: destination.sshUsername,
    password: sshPassword || null,
    savePath: destination.moviesPath,
  })
}

export async function testDestination(
  destination: DownloadDestination,
  secrets: DestinationSecrets,
  isDesktop: boolean,
): Promise<DestinationTestResult> {
  const checks: string[] = []
  let ok = true

  if (destination.kind === 'remote') {
    if (!destination.sshHost.trim() || !destination.sshUsername.trim()) {
      ok = false
      checks.push('Enter SSH host and username.')
    } else if (!destination.moviesPath.trim()) {
      ok = false
      checks.push('Enter the remote movies folder.')
    } else if (!isDesktop) {
      ok = false
      checks.push('Remote SSH is only available in the Torfin desktop app — open the Mac/PC app to test this destination.')
    } else {
      try {
        const ssh = await testSshConnection(destination, secrets.sshPassword)
        checks.push(ssh.message)
        if (!ssh.writable || !ssh.hasWget) ok = false
      } catch (error) {
        ok = false
        checks.push(error instanceof Error ? error.message : 'SSH connection failed.')
      }
    }
  } else if (!destination.moviesPath.trim()) {
    ok = false
    checks.push('Choose a download folder.')
  } else {
    checks.push(`Folder: ${destination.moviesPath}`)
  }

  return { ok, message: checks.join(' · ') }
}

export function readyDestinations(config: DownloadConfig, isDesktop: boolean) {
  return config.destinations.filter((entry) => destinationIsReady(entry, isDesktop))
}

export function shouldPromptDestinationPicker(config: DownloadConfig, isDesktop: boolean) {
  const ready = readyDestinations(config, isDesktop)
  if (!ready.length) return false
  if (ready.length === 1) return false
  const defaultReady = ready.find((entry) => entry.isDefault)
  return !defaultReady
}
