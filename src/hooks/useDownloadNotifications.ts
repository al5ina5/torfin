import { useEffect, useRef } from 'react'

import { ensureNotificationPermission, showAppNotification } from '../lib/notifications'
import type { DownloadJob } from '../types'

type UseDownloadNotificationsArgs = {
  enabled: boolean
  jobs: DownloadJob[]
}

export function useDownloadNotifications({ enabled, jobs }: UseDownloadNotificationsArgs) {
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return
    void ensureNotificationPermission()
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    jobs.forEach((job) => {
      const id = job.status?.id || job.pendingId
      if (!id || notifiedRef.current.has(id)) return

      if (job.status?.complete) {
        notifiedRef.current.add(id)
        showAppNotification('Downloaded', `${job.movie.name} finished downloading.`)
        return
      }

      if (job.status?.state.startsWith('error:') || (job.error && !job.status)) {
        notifiedRef.current.add(id)
        showAppNotification('Download failed', `${job.movie.name} could not finish downloading.`)
      }
    })
  }, [enabled, jobs])
}
