import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { isTauriRuntime, postApi } from '../lib/api'
import type { DownloadJob } from '../types'

type UseJellyfinRefreshArgs = {
  downloadJobs: DownloadJob[]
  setDownloadJobs: Dispatch<SetStateAction<DownloadJob[]>>
}

export function useJellyfinRefresh({ downloadJobs, setDownloadJobs }: UseJellyfinRefreshArgs) {
  const processedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const queue = downloadJobs.filter((job) => {
      const id = job.status?.id || job.pendingId || ''
      const jellyfin = job.pollConfig?.jellyfin
      return Boolean(
        id
        && jellyfin?.refreshOnComplete
        && jellyfin.baseUrl.trim()
        && jellyfin.apiKey.trim()
        && job.status?.complete
        && !job.jellyfinRefreshed
        && !processedIdsRef.current.has(id),
      )
    })
    if (!queue.length) return

    let cancelled = false

    const refreshOne = async (job: DownloadJob) => {
      const id = job.status?.id || job.pendingId || ''
      const jellyfin = job.pollConfig?.jellyfin
      if (!jellyfin) return
      try {
        if (isTauriRuntime()) {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('refresh_jellyfin_library', {
            baseUrl: jellyfin.baseUrl,
            apiKey: jellyfin.apiKey,
          })
        } else {
          await postApi('/api/jellyfin/refresh', {
            baseUrl: jellyfin.baseUrl,
            apiKey: jellyfin.apiKey,
          })
        }
        if (!cancelled) {
          setDownloadJobs((current) =>
            current.map((entry) => ((entry.status?.id || entry.pendingId) === id ? { ...entry, jellyfinRefreshed: true, error: '' } : entry)),
          )
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Downloaded, but Jellyfin refresh failed.'
          setDownloadJobs((current) =>
            current.map((entry) => ((entry.status?.id || entry.pendingId) === id ? { ...entry, error: message } : entry)),
          )
        }
      }
    }

    void (async () => {
      for (const job of queue) {
        const id = job.status?.id || job.pendingId || ''
        processedIdsRef.current.add(id)
        await refreshOne(job)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [downloadJobs, setDownloadJobs])
}
