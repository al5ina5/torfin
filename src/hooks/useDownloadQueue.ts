import { useCallback } from 'react'

import type { DownloadDestination, DownloadJob, Movie, StreamResult } from '../types'

type QueueDownloadArgs = {
  stream: StreamResult
  index: number
  movie: Movie
  episode?: { season: number; episode: number }
  destination: DownloadDestination
  batch?: {
    batchId?: string
    batchLabel?: string
    episodeSeason?: number
    episodeNumber?: number
  }
}

export function buildQueuedDownloadJob(
  args: QueueDownloadArgs & {
    pendingId: string
    pollConfig: DownloadJob['pollConfig']
  },
): DownloadJob {
  const { pendingId, movie, stream, destination, pollConfig, episode, batch } = args
  return {
    pendingId,
    createdAt: new Date().toISOString(),
    movie,
    stream,
    destinationId: destination.id,
    destinationName: destination.name,
    pollConfig,
    batchId: batch?.batchId,
    batchLabel: batch?.batchLabel,
    episodeSeason: batch?.episodeSeason ?? episode?.season,
    episodeNumber: batch?.episodeNumber ?? episode?.episode,
  }
}

export function useDownloadQueueHelpers() {
  const seasonBatchMeta = useCallback((movie: Movie, season: number) => {
    const batchId = `season-${movie.id}-s${season}-${Date.now()}`
    const batchLabel = `${movie.name} · S${season}`
    return { batchId, batchLabel }
  }, [])

  return { seasonBatchMeta, buildQueuedDownloadJob }
}
