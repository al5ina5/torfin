import { downloadJobKey } from '../lib/downloads'
import type { DownloadJob } from '../types'

export function downloadEpisodeLabel(job: DownloadJob) {
  if (job.episodeSeason != null && job.episodeNumber != null) {
    return `S${String(job.episodeSeason).padStart(2, '0')}E${String(job.episodeNumber).padStart(2, '0')}`
  }
  return ''
}

export function groupDownloadJobs(jobs: DownloadJob[]) {
  const groups = new Map<string, DownloadJob[]>()
  const standalone: DownloadJob[] = []

  for (const job of jobs) {
    if (!job.batchId) {
      standalone.push(job)
      continue
    }
    const list = groups.get(job.batchId) ?? []
    list.push(job)
    groups.set(job.batchId, list)
  }

  return { groups, standalone }
}

export function isFailedDownloadJob(job: DownloadJob) {
  return Boolean(job.error || job.status?.state.startsWith('error:'))
}

export function canRetryDownloadJob(job: DownloadJob) {
  return isFailedDownloadJob(job) && !downloadJobKey(job)
}
