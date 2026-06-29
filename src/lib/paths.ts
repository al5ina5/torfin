import type { DownloadConfig } from '../types'

export const DEFAULT_LOCAL_DOWNLOAD_PATH = '~/Downloads/Torfin'
export const DOCKER_DOWNLOAD_PATH = '/media/movies'

export function isLegacyDockerDownloadPath(path: string) {
  const normalized = path.trim().replace(/\/+$/, '')
  return normalized === DOCKER_DOWNLOAD_PATH
}

export function syncLocalDestinationWithServer(config: DownloadConfig, serverDownloadDir: string): DownloadConfig {
  const serverRoot = serverDownloadDir.trim()
  if (!serverRoot) return config

  let changed = false
  const destinations = config.destinations.map((dest) => {
    if (dest.kind !== 'local') return dest
    const path = dest.moviesPath.trim()
    const staleDockerDefault = isLegacyDockerDownloadPath(path) && serverRoot !== DOCKER_DOWNLOAD_PATH
    const missing = !path
    if (!missing && !staleDockerDefault) return dest
    changed = true
    return { ...dest, moviesPath: serverRoot }
  })

  if (!changed) return config
  return { ...config, destinations }
}
