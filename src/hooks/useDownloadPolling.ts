import { useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { getApi } from '../lib/api'
import { qbittorrentPayload, sshPayload } from '../lib/downloads'
import type { DownloadConfig, DownloadJob, DownloadStatus } from '../types'

type UseDownloadPollingArgs = {
  enabled: boolean
  downloadConfig: DownloadConfig
  downloadJobs: DownloadJob[]
  setDownloadJobs: Dispatch<SetStateAction<DownloadJob[]>>
}

export function useDownloadPolling({ enabled, downloadConfig, downloadJobs, setDownloadJobs }: UseDownloadPollingArgs) {
  const activeIdsRef = useRef<string[]>([])

  const pollConfig = useMemo(
    () => ({
      downloader: downloadConfig.downloader,
      qbittorrent: qbittorrentPayload(downloadConfig),
      ssh: sshPayload(downloadConfig),
    }),
    [downloadConfig],
  )

  useEffect(() => {
    activeIdsRef.current = downloadJobs
      .filter((job) => job.status?.id && !job.status.complete && !job.paused)
      .map((job) => job.status?.id || '')
      .filter(Boolean)
  }, [downloadJobs])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let polling = false

    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const ids = activeIdsRef.current
        if (!ids.length) return
        const invokeApi = await import('@tauri-apps/api/core').then((api) => api.invoke)
        const updates = await Promise.all(
          ids.map(async (id) => {
            try {
              const status = pollConfig.downloader === 'qbittorrent'
                ? await invokeApi<DownloadStatus>('get_qbittorrent_download', { config: pollConfig.qbittorrent, id })
                : await invokeApi<DownloadStatus>('get_remote_url_download', { id, config: pollConfig.ssh })
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
      } catch {
        // Keep polling loop alive even if invoke import fails temporarily.
      } finally {
        polling = false
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [enabled, pollConfig, setDownloadJobs])
}

export async function loadServerDownloads() {
  return getApi<DownloadStatus[]>('/api/downloads')
}
