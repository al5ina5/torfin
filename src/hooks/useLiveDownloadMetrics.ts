import { useEffect, useMemo, useRef, useState } from 'react'

import { isDownloadJobDownloading } from '../lib/downloads'
import type { DownloadJob } from '../types'

export type LiveDownloadMetrics = {
  downloaded: number
  speed: number
  eta: number
  progress: number
}

type Snapshot = {
  downloaded: number
  speed: number
  size: number
  progress: number
  eta: number
  at: number
}

const TICK_MS = 250

function jobKey(job: DownloadJob) {
  return job.status?.id || job.pendingId || ''
}

export function useLiveDownloadMetrics(jobs: DownloadJob[]) {
  const snapshotsRef = useRef(new Map<string, Snapshot>())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const now = Date.now()
    const activeIds = new Set<string>()

    for (const job of jobs) {
      const id = jobKey(job)
      const status = job.status
      if (!id || !status || !isDownloadJobDownloading(job)) continue
      activeIds.add(id)
      snapshotsRef.current.set(id, {
        downloaded: status.downloaded,
        speed: status.speed,
        size: status.size,
        progress: status.progress,
        eta: status.eta,
        at: now,
      })
    }

    for (const id of snapshotsRef.current.keys()) {
      if (!activeIds.has(id)) snapshotsRef.current.delete(id)
    }
  }, [jobs])

  const hasLiveJobs = jobs.some((job) => isDownloadJobDownloading(job) && (job.status?.speed ?? 0) > 0)

  useEffect(() => {
    if (!hasLiveJobs) return
    const timer = window.setInterval(() => setTick((value) => value + 1), TICK_MS)
    return () => window.clearInterval(timer)
  }, [hasLiveJobs])

  return useMemo(() => {
    const now = Date.now()
    const metrics = new Map<string, LiveDownloadMetrics>()

    for (const [id, snap] of snapshotsRef.current) {
      const elapsed = (now - snap.at) / 1000
      const speed = snap.speed
      let downloaded = snap.downloaded
      let progress = snap.progress

      if (speed > 0) {
        downloaded = snap.size > 0
          ? Math.min(snap.size, snap.downloaded + speed * elapsed)
          : snap.downloaded + speed * elapsed
        progress = snap.size > 0 ? downloaded / snap.size : snap.progress
      }

      const eta = speed > 0 && snap.size > downloaded ? Math.round((snap.size - downloaded) / speed) : snap.eta
      metrics.set(id, { downloaded, speed, eta, progress })
    }

    return metrics
    // tick drives interpolation between backend polls
  }, [jobs, tick])
}

export function liveMetricsForJob(job: DownloadJob, metrics: Map<string, LiveDownloadMetrics>) {
  const id = jobKey(job)
  return id ? metrics.get(id) : undefined
}
