import { useEffect, useRef } from 'react'

import { ensureNotificationPermission, showAppNotification } from '../lib/notifications'
import { toast } from '../lib/toast'
import type { DownloadJob } from '../types'

type UseDownloadNotificationsArgs = {
  enabled: boolean
  jobs: DownloadJob[]
}

type JobNotificationState = 'active' | 'complete' | 'error'

function jobNotificationState(job: DownloadJob): JobNotificationState {
  if (job.status?.complete) return 'complete'
  if (job.status?.state.startsWith('error:') || (job.error && !job.status)) return 'error'
  return 'active'
}

export function useDownloadNotifications({ enabled, jobs }: UseDownloadNotificationsArgs) {
  const prevStateRef = useRef<Map<string, JobNotificationState>>(new Map())

  useEffect(() => {
    if (!enabled) return
    void ensureNotificationPermission()
  }, [enabled])

  useEffect(() => {
    jobs.forEach((job) => {
      const id = job.status?.id || job.pendingId
      if (!id) return

      const currentState = jobNotificationState(job)
      const previousState = prevStateRef.current.get(id)
      prevStateRef.current.set(id, currentState)

      if (!enabled || previousState === undefined) return

      if (currentState === 'complete' && previousState !== 'complete') {
        showAppNotification('Downloaded', `${job.movie.name} finished downloading.`)
        toast.success('Download complete', job.movie.name)
        return
      }

      if (currentState === 'error' && previousState !== 'error') {
        showAppNotification('Download failed', `${job.movie.name} could not finish downloading.`)
        const detail = job.error || job.status?.state.replace(/^error:/, '').replace(/^\d+\s*/, '') || 'Unknown error'
        toast.error('Download failed', `${job.movie.name}: ${detail}`)
      }
    })
  }, [enabled, jobs])
}
