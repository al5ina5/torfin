import { isTauriRuntime, postApi } from './api'
import { getSecret, setSecret } from './secrets'
import type { DownloadConfig, DownloadDestination, DownloadDestinationKind, Movie } from '../types'

export type DestinationSecrets = {
  jellyfinApiKey: string
  sshPassword: string
}

export type DestinationTestResult = {
  ok: boolean
  message: string
  jellyfinName?: string
  jellyfinVersion?: string
}

export function destinationJellyfinSecretKey(id: string) {
  return `dest_jellyfin_${id}`
}

export function destinationSshSecretKey(id: string) {
  return `dest_ssh_${id}`
}

export function createDestinationId() {
  return `dest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultLocalDestinationName(isDesktop: boolean) {
  return isDesktop ? 'This Mac' : 'This Server'
}

export function defaultRemoteDestinationName() {
  return 'Home Jellyfin'
}

export function newDestination(kind: DownloadDestinationKind, isDesktop: boolean): DownloadDestination {
  return {
    id: createDestinationId(),
    name: kind === 'local' ? defaultLocalDestinationName(isDesktop) : defaultRemoteDestinationName(),
    kind,
    isDefault: false,
    moviesPath: kind === 'local' ? (isDesktop ? `${homeHint()}/Movies/Torfin` : '/media/movies') : '',
    tvPath: '',
    jellyfinUrl: '',
    refreshOnComplete: kind === 'remote-jellyfin',
    sshHost: '',
    sshPort: 22,
    sshUsername: '',
  }
}

function homeHint() {
  return isTauriRuntime() ? '~/Movies/Torfin' : '/media/movies'
}

export function migrateDownloadConfig(config: DownloadConfig, isDesktop: boolean): DownloadConfig {
  if (config.destinations?.length) {
    return normalizeDestinations(config)
  }

  const hasLegacyRemote = Boolean(config.sshHost.trim() && config.sshSavePath.trim())
  const hasLegacyLocal = Boolean(config.localSavePath.trim() || config.downloader === 'local')
  const destinations: DownloadDestination[] = []

  if (hasLegacyRemote || config.downloader === 'ssh') {
    destinations.push({
      id: createDestinationId(),
      name: defaultRemoteDestinationName(),
      kind: 'remote-jellyfin',
      isDefault: config.downloader === 'ssh' || hasLegacyRemote,
      moviesPath: config.sshSavePath || config.savePath || '/media/movies',
      tvPath: config.tvSavePath || '',
      jellyfinUrl: config.jellyfinUrl || '',
      refreshOnComplete: config.refreshJellyfinOnComplete,
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
      moviesPath: config.localSavePath || '/media/movies',
      tvPath: config.tvSavePath || '',
      jellyfinUrl: config.jellyfinUrl || '',
      refreshOnComplete: config.refreshJellyfinOnComplete,
      sshHost: '',
      sshPort: 22,
      sshUsername: '',
    })
  }

  if (!destinations.length) {
    destinations.push({
      ...newDestination(isDesktop ? 'remote-jellyfin' : 'local', isDesktop),
      isDefault: true,
      moviesPath: isDesktop ? '' : '/media/movies',
    })
  }

  if (!destinations.some((entry) => entry.isDefault)) {
    destinations[0] = { ...destinations[0], isDefault: true }
  }

  const active = destinations.find((entry) => entry.isDefault) ?? destinations[0]

  return normalizeDestinations({
    ...config,
    destinations,
    activeDestinationId: active.id,
  })
}

function normalizeDestinations(config: DownloadConfig): DownloadConfig {
  const destinations = (config.destinations || []).map((entry) => ({
    ...entry,
    sshPort: entry.sshPort || 22,
  }))
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

export function destinationIsReady(destination: DownloadDestination | undefined, isDesktop: boolean) {
  if (!destination) return false
  if (!destination.moviesPath.trim()) return false
  if (destination.kind === 'local') return true
  if (!isDesktop) return false
  return Boolean(destination.sshHost.trim() && destination.sshUsername.trim())
}

export function destinationNeedsJellyfinKey(destination: DownloadDestination) {
  return destination.kind === 'remote-jellyfin' || destination.refreshOnComplete
}

export function destinationSummary(destination: DownloadDestination) {
  if (destination.kind === 'local') {
    return `Local · ${destination.moviesPath}`
  }
  const host = destination.sshHost || 'remote server'
  return `Remote · ${host} · ${destination.moviesPath}`
}

export function destinationKindLabel(destination: DownloadDestination, isDesktop: boolean) {
  if (destination.kind === 'local') return isDesktop ? 'This device' : 'This server'
  return 'Remote Jellyfin'
}

export async function loadDestinationSecrets(destination: DownloadDestination): Promise<DestinationSecrets> {
  const [jellyfinApiKey, sshPassword] = await Promise.all([
    getSecret(destinationJellyfinSecretKey(destination.id)),
    getSecret(destinationSshSecretKey(destination.id)),
  ])
  return {
    jellyfinApiKey: jellyfinApiKey || '',
    sshPassword: sshPassword || '',
  }
}

export async function saveDestinationSecrets(destinationId: string, secrets: Partial<DestinationSecrets>) {
  if (secrets.jellyfinApiKey !== undefined) {
    await setSecret(destinationJellyfinSecretKey(destinationId), secrets.jellyfinApiKey)
  }
  if (secrets.sshPassword !== undefined) {
    await setSecret(destinationSshSecretKey(destinationId), secrets.sshPassword)
  }
}

export async function migrateLegacySecrets(config: DownloadConfig, legacy: { jellyfinApiKey: string; sshPassword: string }) {
  const defaultDest = getDefaultDestination(config)
  if (!defaultDest) return
  const existing = await loadDestinationSecrets(defaultDest)
  await saveDestinationSecrets(defaultDest.id, {
    jellyfinApiKey: existing.jellyfinApiKey || legacy.jellyfinApiKey,
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
): DownloadConfig {
  const isRemote = destination.kind === 'remote-jellyfin'
  return {
    ...config,
    activeDestinationId: destination.id,
    jellyfinUrl: destination.jellyfinUrl,
    jellyfinApiKey: secrets.jellyfinApiKey,
    refreshJellyfinOnComplete: destination.refreshOnComplete,
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
  if (!destination.sshHost.trim()) throw new Error('Enter the SSH host for your Jellyfin server.')
  if (!destination.sshUsername.trim()) throw new Error('Enter the SSH username.')
  if (!destination.moviesPath.trim()) throw new Error('Enter the folder Jellyfin watches for movies.')
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

  if (destinationNeedsJellyfinKey(destination) && destination.jellyfinUrl.trim()) {
    try {
      const info = await testJellyfinConnection(destination.jellyfinUrl, secrets.jellyfinApiKey)
      checks.push(`Jellyfin: ${info.name} ${info.version}`)
    } catch (error) {
      ok = false
      checks.push(error instanceof Error ? error.message : 'Jellyfin connection failed.')
    }
  } else if (destination.kind === 'remote-jellyfin') {
    ok = false
    checks.push('Add your Jellyfin URL and API key.')
  }

  if (destination.kind === 'remote-jellyfin') {
    if (!isDesktop) {
      ok = false
      checks.push('Remote SSH downloads need the desktop app.')
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

  return {
    ok,
    message: checks.join(' · '),
    jellyfinName: undefined,
    jellyfinVersion: undefined,
  }
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
