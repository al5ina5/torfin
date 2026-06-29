import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { DownloadJob, DownloadStatus } from '../types'

type UseDownloadPollingArgs = {
  enabled: boolean
  downloadJobs: DownloadJob[]
  setDownloadJobs: Dispatch<SetStateAction<DownloadJob[]>>
}

const POLL_INTERVAL_MS = 500

export function useDownloadPolling({ enabled, downloadJobs, setDownloadJobs }: UseDownloadPollingArgs) {
  const jobsRef = useRef<DownloadJob[]>([])

  useEffect(() => {
    jobsRef.current = downloadJobs.filter((job) => job.status?.id && !job.status.complete && !job.paused)
  }, [downloadJobs])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const pollOnce = async () => {
      const jobs = jobsRef.current
      if (!jobs.length) return
      const invokeApi = await import('@tauri-apps/api/core').then((api) => api.invoke)
      const updates = await Promise.all(
        jobs.map(async (job) => {
          const id = job.status?.id || ''
          const pollConfig = job.pollConfig
          if (!id || !pollConfig) return { id, error: 'Missing download tracking config.' }
          try {
            const status =
              pollConfig.mode === 'qbittorrent'
                ? await invokeApi<DownloadStatus>('get_qbittorrent_download', { config: pollConfig.qbittorrent, id })
                : pollConfig.mode === 'ssh'
                  ? await invokeApi<DownloadStatus>('get_remote_url_download', { id, config: pollConfig.ssh })
                  : await invokeApi<DownloadStatus>('get_local_url_download', { id })
            return { id, status, error: '' }
          } catch (error) {
            return { id, error: error instanceof Error ? error.message : 'Could not poll download.' }
          }
        }),
      )
      if (cancelled) return
      setDownloadJobs((current) =>
        current.map((job) => {
          const update = updates.find((item) => item.id === job.status?.id)
          return update ? { ...job, status: update.status ?? job.status, error: update.error } : job
        }),
      )
    }

    const loop = async () => {
      while (!cancelled) {
        const started = Date.now()
        try {
          await pollOnce()
        } catch {
          // Keep polling loop alive even if invoke import fails temporarily.
        }
        if (cancelled) break
        const wait = Math.max(0, POLL_INTERVAL_MS - (Date.now() - started))
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, wait)
        })
      }
    }

    void loop()
    return () => {
      cancelled = true
    }
  }, [enabled, setDownloadJobs])
}

export async function loadServerDownloads() {
  const { getApi } = await import('../lib/api')
  return getApi<import('../types').DownloadStatus[]>('/api/downloads')
}
