import { useEffect } from 'react'

import { setDockBadge } from '../lib/dock-badge'
import { isDownloadJobDownloading } from '../lib/downloads'
import type { DownloadJob } from '../types'

export function useDockBadge(jobs: DownloadJob[]) {
  useEffect(() => {
    const activeCount = jobs.filter(isDownloadJobDownloading).length
    void setDockBadge(activeCount)
  }, [jobs])
}
