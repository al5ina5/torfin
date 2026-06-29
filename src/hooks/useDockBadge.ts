import { useEffect } from 'react'

import { setDockBadge } from '../lib/dock-badge'
import { isActiveDownloadJob } from '../lib/downloads'
import type { DownloadJob } from '../types'

export function useDockBadge(jobs: DownloadJob[]) {
  useEffect(() => {
    const activeCount = jobs.filter((job) => isActiveDownloadJob(job) && !job.paused).length
    void setDockBadge(activeCount)
  }, [jobs])
}
