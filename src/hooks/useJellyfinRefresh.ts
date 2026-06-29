import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { isJellyfinImportConfirmed, jellyfinSyncConfigured } from '../lib/downloads'
import { isTauriRuntime, postApi } from '../lib/api'
import type { DownloadJob } from '../types'

type UseJellyfinRefreshArgs = {
  downloadJobs: DownloadJob[]
  setDownloadJobs: Dispatch<SetStateAction<DownloadJob[]>>
}

type JellyfinImportMatch = {
  itemId: string
  path?: string
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function savePathForJob(job: DownloadJob) {
  return job.pollConfig?.local?.savePath || job.pollConfig?.ssh?.savePath || job.status?.savePath || ''
}

async function waitForJellyfinImport(job: DownloadJob, jellyfin: NonNullable<DownloadJob['pollConfig']>['jellyfin']) {
  const targetPath = job.status?.targetPath
  if (!targetPath || !jellyfin) return null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const match = isTauriRuntime()
        ? await import('@tauri-apps/api/core').then(({ invoke }) =>
            invoke<JellyfinImportMatch | null>('verify_jellyfin_import', {
              baseUrl: jellyfin.baseUrl,
              apiKey: jellyfin.apiKey,
              targetPath,
              pathMapFrom: savePathForJob(job) || null,
              pathMapTo: null,
            }),
          )
        : await postApi<JellyfinImportMatch | null>('/api/jellyfin/verify-import', {
            baseUrl: jellyfin.baseUrl,
            apiKey: jellyfin.apiKey,
            targetPath,
            pathMapFrom: savePathForJob(job) || null,
            pathMapTo: null,
          })
      if (match?.itemId) return match
    } catch {
      // Keep retrying until attempts are exhausted.
    }
    await sleep(attempt < 2 ? 1000 : 2500)
  }
  return null
}

export function useJellyfinRefresh({ downloadJobs, setDownloadJobs }: UseJellyfinRefreshArgs) {
  const processedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isTauriRuntime()) return

    const queue = downloadJobs.filter((job) => {
      const id = job.status?.id || job.pendingId || ''
      return Boolean(
        id
        && jellyfinSyncConfigured(job)
        && job.status?.complete
        && !isJellyfinImportConfirmed(job.status)
        && !processedIdsRef.current.has(id),
      )
    })
    if (!queue.length) return

    let cancelled = false

    const syncOne = async (job: DownloadJob) => {
      const id = job.status?.id || job.pendingId || ''
      const jellyfin = job.pollConfig?.jellyfin
      if (!jellyfin) return

      const now = new Date().toISOString()
      setDownloadJobs((current) =>
        current.map((entry) =>
          (entry.status?.id || entry.pendingId) === id
            ? {
                ...entry,
                status: entry.status
                  ? { ...entry.status, jellyfinRefreshRequested: entry.status.jellyfinRefreshRequested || now }
                  : entry.status,
              }
            : entry,
        ),
      )

      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('refresh_jellyfin_library', {
          baseUrl: jellyfin.baseUrl,
          apiKey: jellyfin.apiKey,
        })
        const match = await waitForJellyfinImport(job, jellyfin)
        if (cancelled) return

        setDownloadJobs((current) =>
          current.map((entry) => {
            if ((entry.status?.id || entry.pendingId) !== id || !entry.status) return entry
            if (match?.itemId) {
              return {
                ...entry,
                jellyfinRefreshed: true,
                error: '',
                status: {
                  ...entry.status,
                  jellyfinRefreshOk: now,
                  jellyfinImportedAt: new Date().toISOString(),
                  jellyfinItemId: match.itemId,
                  jellyfinItemPath: match.path || '',
                  jellyfinImportError: '',
                },
              }
            }
            return {
              ...entry,
              jellyfinRefreshed: true,
              status: {
                ...entry.status,
                jellyfinRefreshOk: now,
                jellyfinImportError: 'Jellyfin scan finished but the file was not found in the library yet.',
              },
            }
          }),
        )
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Downloaded, but Jellyfin refresh failed.'
        setDownloadJobs((current) =>
          current.map((entry) =>
            (entry.status?.id || entry.pendingId) === id && entry.status
              ? {
                  ...entry,
                  status: {
                    ...entry.status,
                    jellyfinRefreshError: message,
                  },
                }
              : entry,
          ),
        )
      }
    }

    void (async () => {
      for (const job of queue) {
        const id = job.status?.id || job.pendingId || ''
        processedIdsRef.current.add(id)
        await syncOne(job)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [downloadJobs, setDownloadJobs])
}
