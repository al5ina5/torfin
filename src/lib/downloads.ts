import type { DownloadConfig, DownloadDestination, DownloadJob, DownloadPollConfig, DownloadSort, DownloadStatus, Movie, StreamResult } from '../types'
import { destinationRootForMovie } from './download-destinations'
import type { DestinationSecrets } from './download-destinations'

export const defaultDownloadConfig: DownloadConfig = {
  jellyfinUrl: '',
  jellyfinApiKey: '',
  downloader: 'local',
  localSavePath: '/media/movies',
  tvSavePath: '',
  sshHost: '',
  sshUsername: '',
  sshPassword: '',
  sshSavePath: '',
  qbittorrentUrl: '',
  qbittorrentUsername: '',
  qbittorrentPassword: '',
  savePath: '',
  category: '',
  refreshJellyfinOnComplete: true,
  activeDestinationId: '',
  destinations: [],
}

export function withDownloadTimestamp(job: DownloadJob): DownloadJob {
  return { ...job, createdAt: job.createdAt || job.status?.createdAt || new Date().toISOString() }
}

function downloadCreatedTime(job: DownloadJob) {
  return Date.parse(job.createdAt || job.status?.createdAt || '') || 0
}

export function isActiveDownloadJob(job: DownloadJob) {
  return Boolean(job.status && !job.status.complete && !job.status.state.startsWith('error:'))
}

export function isFinishedDownloadJob(job: DownloadJob) {
  return Boolean(job.status?.complete || job.status?.state.startsWith('error:') || job.error)
}

export function sortDownloadJobs(jobs: DownloadJob[], sort: DownloadSort) {
  return [...jobs].sort((left, right) => {
    if (sort === 'active') {
      const activeDelta = Number(isActiveDownloadJob(right)) - Number(isActiveDownloadJob(left))
      if (activeDelta) return activeDelta
    }
    if (sort === 'finishedLast') {
      const finishedDelta = Number(isFinishedDownloadJob(left)) - Number(isFinishedDownloadJob(right))
      if (finishedDelta) return finishedDelta
    }
    const timeDelta = downloadCreatedTime(right) - downloadCreatedTime(left)
    return sort === 'oldest' ? -timeDelta : timeDelta
  })
}

export function dedupeDownloadJobs(jobs: DownloadJob[]) {
  const seen = new Set<string>()
  return jobs.filter((job) => {
    const key = job.status?.id ?? job.pendingId ?? `${job.movie.id}-${job.stream.pluginName}-${job.stream.infoHash ?? job.stream.url ?? job.stream.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function downloadJobFromStatus(status: DownloadStatus): DownloadJob {
  const folder = status.savePath?.split('/').filter(Boolean).at(-1) ?? status.name.replace(/\.[^.]+$/, '')
  const match = folder.match(/^(.*?)(?:\s+\((\d{4})\))?$/)
  const movieName = match?.[1] || status.name.replace(/\s+-\s+.*$/, '').replace(/\.[^.]+$/, '')
  const releaseInfo = match?.[2] || ''
  return {
    pendingId: status.id,
    createdAt: status.createdAt || new Date().toISOString(),
    movie: {
      id: status.id,
      type: 'movie',
      name: movieName,
      releaseInfo,
      poster: '',
      description: status.targetPath || status.savePath || '',
    },
    stream: {
      pluginName: 'Server',
      title: status.name,
      tags: status.engine ? [status.engine] : [],
      rank: 0,
    },
    status,
  }
}

export function mergeServerDownloadJobs(current: DownloadJob[], statuses: DownloadStatus[]) {
  const byId = new Map(statuses.map((status) => [status.id, status]))
  const merged = current
    .filter((job) => {
      const id = job.status?.id ?? job.pendingId
      return !id || byId.has(id) || !job.status
    })
    .map((job) => {
      const id = job.status?.id ?? job.pendingId
      const status = id ? byId.get(id) : undefined
      if (!status) return withDownloadTimestamp(job)
      byId.delete(status.id)
      return withDownloadTimestamp({ ...job, pendingId: status.id, status, error: status.state.startsWith('error:') ? '' : job.error })
    })
  for (const status of byId.values()) merged.push(downloadJobFromStatus(status))
  return dedupeDownloadJobs(merged)
}

export function qbittorrentPayload(config: DownloadConfig) {
  return {
    baseUrl: config.qbittorrentUrl,
    username: config.qbittorrentUsername,
    password: config.qbittorrentPassword,
    savePath: config.savePath || null,
    category: config.category || null,
  }
}

export function buildPollConfig(
  config: DownloadConfig,
  destination: DownloadDestination,
  secrets: DestinationSecrets,
  movie?: Movie,
): DownloadPollConfig {
  const savePath = movie ? destinationRootForMovie(destination, movie) : destination.moviesPath
  const jellyfin =
    destination.refreshOnComplete && destination.jellyfinUrl.trim() && secrets.jellyfinApiKey.trim()
      ? { baseUrl: destination.jellyfinUrl, apiKey: secrets.jellyfinApiKey, refreshOnComplete: true }
      : undefined

  if (destination.kind === 'remote-jellyfin') {
    return {
      mode: 'ssh',
      ssh: {
        host: destination.sshHost,
        username: destination.sshUsername,
        password: secrets.sshPassword || null,
        savePath,
      },
      jellyfin,
    }
  }

  if (config.downloader === 'qbittorrent') {
    return {
      mode: 'qbittorrent',
      qbittorrent: qbittorrentPayload({ ...config, savePath }),
      jellyfin,
    }
  }

  return {
    mode: 'local',
    local: { savePath },
    jellyfin,
  }
}

export function downloadRootForMovie(config: DownloadConfig, movie: Movie) {
  if (movie.type === 'series' && config.tvSavePath.trim()) return config.tvSavePath.trim()
  if (movie.type === 'series' && config.downloader === 'local' && config.localSavePath.trim()) {
    return config.localSavePath.trim()
  }
  if (config.downloader === 'local') return config.localSavePath || config.sshSavePath || config.savePath
  return config.sshSavePath || config.savePath
}

export function sshPayload(config: DownloadConfig, movie?: Movie) {
  const savePath = movie ? downloadRootForMovie(config, movie) : config.sshSavePath || config.savePath
  return {
    host: config.sshHost,
    username: config.sshUsername,
    password: config.sshPassword || null,
    savePath,
  }
}

export function localPayload(config: DownloadConfig, movie?: Movie) {
  return {
    savePath: movie ? downloadRootForMovie(config, movie) : config.localSavePath || config.sshSavePath || config.savePath,
  }
}

export function makeDownloadFilename(movie: Movie, stream: StreamResult, episode?: { season: number; episode: number }) {
  const quality = stream.tags.find((tag) => /^\d/.test(tag)) ?? ''
  const episodeTag = episode ? ` S${String(episode.season).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')}` : ''
  return `${movie.name}${episodeTag}${quality ? ` - ${quality}` : ''} - ${stream.pluginName}.mkv`
}

export function makeMovieFolderName(movie: Movie, episode?: { season: number; episode: number }) {
  const base = `${movie.name}${movie.releaseInfo ? ` (${movie.releaseInfo})` : ''}`
  if (!episode) return base
  return `${base}/Season ${episode.season}`
}

export function bytesLabel(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

export function etaLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 8640000) return 'ETA unknown'
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
