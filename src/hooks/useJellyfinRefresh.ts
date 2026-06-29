import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { isTauriRuntime, postApi } from '../lib/api'
import type { DownloadConfig, DownloadJob } from '../types'

type UseJellyfinRefreshArgs = {
  downloadConfig: DownloadConfig
  downloadJobs: DownloadJob[]
  setDownloadJobs: Dispatch<SetStateAction<DownloadJob[]>>
}

export function useJellyfinRefresh({ downloadConfig, downloadJobs, setDownloadJobs }: UseJellyfinRefreshArgs) {
  const processedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!downloadConfig.refreshJellyfinOnComplete) return
    if (!downloadConfig.jellyfinUrl.trim() || !downloadConfig.jellyfinApiKey.trim()) return

    const queue = downloadJobs.filter((job) => {
      const id = job.status?.id || job.pendingId || ''
      return Boolean(id && job.status?.complete && !job.jellyfinRefreshed && !processedIdsRef.current.has(id))
    })
    if (!queue.length) return

    let cancelled = false

    const refreshOne = async (id: string) => {
      try {
        if (isTauriRuntime()) {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('refresh_jellyfin_library', {
            baseUrl: downloadConfig.jellyfinUrl,
            apiKey: downloadConfig.jellyfinApiKey,
          })
        } else {
          await postApi('/api/jellyfin/refresh', {
            baseUrl: downloadConfig.jellyfinUrl,
            apiKey: downloadConfig.jellyfinApiKey,
          })
        }
        if (!cancelled) {
          setDownloadJobs((current) =>
            current.map((job) => ((job.status?.id || job.pendingId) === id ? { ...job, jellyfinRefreshed: true, error: '' } : job)),
          )
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Downloaded, but Jellyfin refresh failed.'
          setDownloadJobs((current) =>
            current.map((job) => ((job.status?.id || job.pendingId) === id ? { ...job, error: message } : job)),
          )
        }
      }
    }

    void (async () => {
      for (const job of queue) {
        const id = job.status?.id || job.pendingId || ''
        processedIdsRef.current.add(id)
        await refreshOne(id)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [downloadConfig, downloadJobs, setDownloadJobs])
}
