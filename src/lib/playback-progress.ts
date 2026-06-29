import { STORAGE_KEYS, loadStoredJson, saveStoredJson } from './storage'
import type { Movie, PlaybackProgress } from '../types'

type PlaybackProgressConfig = {
  minProgressSeconds: number
  completeRatio: number
  maxEntries: number
}

const defaultConfig: PlaybackProgressConfig = {
  minProgressSeconds: 30,
  completeRatio: 0.92,
  maxEntries: 40,
}

let progressConfig = { ...defaultConfig }

export function setPlaybackProgressConfig(patch: Partial<PlaybackProgressConfig>) {
  progressConfig = { ...progressConfig, ...patch }
}

export function loadPlaybackProgress(): PlaybackProgress[] {
  return loadStoredJson<PlaybackProgress[]>(STORAGE_KEYS.playbackProgress, [])
}

function savePlaybackProgress(entries: PlaybackProgress[]) {
  saveStoredJson(STORAGE_KEYS.playbackProgress, entries)
}

function progressKey(movie: Movie, season?: number, episode?: number) {
  if (movie.type === 'series' && season !== undefined && episode !== undefined) {
    return `${movie.type}:${movie.id}:${season}:${episode}`
  }
  return `${movie.type}:${movie.id}`
}

export function savePlaybackPosition(
  movie: Movie,
  position: number,
  duration: number,
  season?: number,
  episode?: number,
) {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return
  if (position < progressConfig.minProgressSeconds) return

  const key = progressKey(movie, season, episode)
  const entries = loadPlaybackProgress().filter((entry) => progressKey(entry.movie, entry.season, entry.episode) !== key)

  if (position / duration >= progressConfig.completeRatio) {
    savePlaybackProgress(entries)
    return
  }

  entries.unshift({
    movieId: movie.id,
    type: movie.type,
    season,
    episode,
    position,
    duration,
    updatedAt: new Date().toISOString(),
    movie,
  })
  savePlaybackProgress(entries.slice(0, progressConfig.maxEntries))
}

export function getPlaybackResumePosition(movie: Movie, season?: number, episode?: number) {
  const key = progressKey(movie, season, episode)
  const entry = loadPlaybackProgress().find((item) => progressKey(item.movie, item.season, item.episode) === key)
  if (!entry || entry.position < progressConfig.minProgressSeconds) return null
  if (entry.duration > 0 && entry.position / entry.duration >= progressConfig.completeRatio) return null
  return entry.position
}

export function continueWatchingMovies() {
  return loadPlaybackProgress().map((entry) => entry.movie)
}

export function removePlaybackProgress(movie: Movie, season?: number, episode?: number) {
  const key = progressKey(movie, season, episode)
  savePlaybackProgress(
    loadPlaybackProgress().filter((entry) => progressKey(entry.movie, entry.season, entry.episode) !== key),
  )
}

export function formatProgressLabel(entry: PlaybackProgress) {
  if (entry.type === 'series' && entry.season !== undefined && entry.episode !== undefined) {
    return `S${String(entry.season).padStart(2, '0')}E${String(entry.episode).padStart(2, '0')}`
  }
  return ''
}

export function progressPercent(entry: PlaybackProgress) {
  if (!entry.duration) return 0
  return Math.min(100, Math.round((entry.position / entry.duration) * 100))
}

export type EpisodeSelection = { season: number; episode: number }

export function nextEpisode(
  episodes: Array<{ season: number; episode: number }>,
  current: EpisodeSelection,
): EpisodeSelection | null {
  const index = episodes.findIndex((entry) => entry.season === current.season && entry.episode === current.episode)
  if (index < 0 || index >= episodes.length - 1) return null
  const next = episodes[index + 1]
  return { season: next.season, episode: next.episode }
}
