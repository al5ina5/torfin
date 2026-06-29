import { HardDriveDownload, Loader2, Pause, Play } from 'lucide-react'

import { liveMetricsForJob, useLiveDownloadMetrics } from '../hooks/useLiveDownloadMetrics'
import { bytesLabel, downloadStatusLabel, etaLabel, isActiveDownloadJob, sortDownloadJobs } from '../lib/downloads'
import type { DownloadJob, DownloadSort } from '../types'
import { AppModal } from './AppModal'
import { MoviePoster } from './MoviePoster'

type DownloadsModalProps = {
  open: boolean
  jobs: DownloadJob[]
  sort: DownloadSort
  sortOpen: boolean
  onClose: () => void
  onSortOpen: (next: boolean) => void
  onSortChange: (sort: DownloadSort) => void
  onClearFinished: () => void
  onRemoveJob: (job: DownloadJob) => void
  onPauseJob?: (job: DownloadJob) => void
  onResumeJob?: (job: DownloadJob) => void
}

export function DownloadsModal({
  open,
  jobs,
  sort,
  sortOpen,
  onClose,
  onSortOpen,
  onSortChange,
  onClearFinished,
  onRemoveJob,
  onPauseJob,
  onResumeJob,
}: DownloadsModalProps) {
  const liveMetrics = useLiveDownloadMetrics(jobs)
  const sortedJobs = sortDownloadJobs(jobs, sort)
  const activeJobs = jobs.filter((job) => isActiveDownloadJob(job) && !job.paused).length
  const sortLabel = {
    newest: 'Newest first',
    oldest: 'Oldest first',
    active: 'Active first',
    finishedLast: 'Finished last',
  }[sort]

  return (
    <AppModal
      open={open}
      title="Download"
      icon={<HardDriveDownload size={15} />}
      onClose={onClose}
      className="download-modal-panel"
      bodyClassName="app-screen-body flex min-h-0 flex-1 flex-col overflow-hidden gap-2"
      zClassName="z-40"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 text-[11px] text-[var(--mac-secondary)]">
        <span>
          {jobs.length} {jobs.length === 1 ? 'item' : 'items'}
        </span>
        <div className="flex items-center gap-2">
          {jobs.length ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => onSortOpen(!sortOpen)}
                className="h-7 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[11px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
              >
                {sortLabel}
              </button>
              {sortOpen ? (
                <div className="absolute right-0 top-8 z-10 min-w-40 rounded-lg border border-[var(--mac-border)] bg-[var(--mac-elevated)] p-1 shadow-xl">
                  {(['newest', 'oldest', 'active', 'finishedLast'] as DownloadSort[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        onSortChange(value)
                        onSortOpen(false)
                      }}
                      className={`block h-7 w-full rounded-md px-2 text-left text-[11px] font-semibold ${
                        value === sort
                          ? 'bg-[var(--mac-control-hover)] text-[var(--mac-text)]'
                          : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control)]'
                      }`}
                    >
                      {value === 'newest' ? 'Newest first' : null}
                      {value === 'oldest' ? 'Oldest first' : null}
                      {value === 'active' ? 'Active first' : null}
                      {value === 'finishedLast' ? 'Finished last' : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="h-7 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 text-[11px] font-semibold transition hover:bg-[var(--mac-control-hover)]"
            onClick={onClearFinished}
          >
            Clear Finished
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sortedJobs.length ? (
          <div className="space-y-2">
            {sortedJobs.map((job) => {
              const status = job.status
              const live = liveMetricsForJob(job, liveMetrics)
              const progressValue = live?.progress ?? status?.progress ?? 0
              const progress = Math.round(progressValue * 100)
              const displaySpeed = live?.speed ?? status?.speed ?? 0
              const displayEta = live?.eta ?? status?.eta ?? -1
              const displayDownloaded = live?.downloaded ?? status?.downloaded ?? 0
              const isActive = isActiveDownloadJob(job) && !job.paused && status?.state !== 'paused'
              const isPaused = Boolean((job.paused || status?.state === 'paused') && isActiveDownloadJob(job))
              const isStalled = status?.state === 'stalled'
              const title = status?.name ?? job.stream.title
              const stateLabel = downloadStatusLabel(job)
              const jellyfinReady = stateLabel === 'available in jellyfin'
              const isResolving = !status && !job.error
              return (
                <div key={status?.id || job.pendingId || `${job.movie.id}-${job.stream.title}`} className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="relative mt-0.5 h-10 w-7 shrink-0 overflow-hidden rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)]">
                      <MoviePoster src={job.movie.poster} iconSize={12} />
                      {isActive || isResolving ? (
                        <div className="absolute inset-0 grid place-items-center bg-black/40">
                          <Loader2 className="animate-spin text-white" size={14} />
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{job.movie.name}</h3>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[11px] text-[var(--mac-secondary)]">{progress}%</span>
                          {isPaused && onResumeJob ? (
                            <button
                              type="button"
                              onClick={() => onResumeJob(job)}
                              className="grid size-7 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)]"
                              title="Resume"
                            >
                              <Play size={13} />
                            </button>
                          ) : null}
                          {isActive && onPauseJob ? (
                            <button
                              type="button"
                              onClick={() => onPauseJob(job)}
                              className="grid size-7 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)]"
                              title="Pause"
                            >
                              <Pause size={13} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onRemoveJob(job)}
                            className="grid size-7 place-items-center rounded-md border border-transparent text-[var(--mac-secondary)] transition hover:border-[var(--mac-border)] hover:bg-[var(--mac-control-hover)] hover:text-[var(--mac-text)]"
                            title="Cancel"
                          >
                            <span className="text-[13px] font-semibold">x</span>
                          </button>
                        </div>
                      </div>
                      <p className="truncate text-[11px] leading-4 text-[var(--mac-secondary)]">{title}</p>

                      {status ? (
                        <div className="mt-1.5">
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--mac-control)]">
                            <div
                              className={`h-full rounded-full transition-[width] duration-150 ease-linear ${
                                isActive ? 'animate-pulse' : ''
                              } ${
                                status.state.startsWith('error:')
                                  ? 'bg-red-500'
                                  : isStalled
                                    ? 'bg-amber-500'
                                    : status.complete
                                      ? jellyfinReady
                                        ? 'bg-violet-500'
                                        : 'bg-emerald-500'
                                      : 'bg-[var(--mac-accent)]'
                              }`}
                              style={{ width: `${Math.max(progressValue * 100, isActive ? 1 : 0)}%` }}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-[var(--mac-secondary)]">
                            <span className={`font-medium ${jellyfinReady ? 'text-violet-600 dark:text-violet-300' : 'text-[var(--mac-text)]'}`}>
                              {stateLabel}
                            </span>
                            {status.complete ? (
                              <span>{status.size > 0 ? bytesLabel(status.size) : bytesLabel(status.downloaded)}</span>
                            ) : isPaused ? (
                              <span>
                                {bytesLabel(status.downloaded)} / {status.size > 0 ? bytesLabel(status.size) : 'Unknown'}
                              </span>
                            ) : (
                              <>
                                <span>{bytesLabel(displaySpeed)}/s</span>
                                <span>{etaLabel(displayEta)}</span>
                                <span>
                                  {bytesLabel(displayDownloaded)} / {status.size > 0 ? bytesLabel(status.size) : 'Unknown'}
                                </span>
                                {status.connections && isActive ? <span>{status.connections} conn</span> : null}
                              </>
                            )}
                          </div>
                        </div>
                      ) : job.error ? null : (
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--mac-secondary)]">
                          <Loader2 className="animate-spin text-[var(--mac-accent)]" size={13} />
                          Resolving Torbox result
                        </div>
                      )}
                    </div>
                  </div>

                  {status?.statusMessage ? (
                    <div className="ml-9 mt-2 rounded-md border border-[var(--mac-border)] bg-[var(--mac-surface)] px-2.5 py-2 text-[11px] leading-4 text-[var(--mac-secondary)]">
                      <div>{status.statusMessage}</div>
                      {status.statusAction ? <div className="mt-1 font-medium">{status.statusAction}</div> : null}
                    </div>
                  ) : null}

                  {status?.state.startsWith('error:') ? (
                    <div className="ml-9 mt-2 text-[11px] leading-4 text-[var(--mac-secondary)]">
                      Failed · {status.state.replace(/^error:/, '').replace(/^\d+\s*/, '') || 'Unknown error'}
                    </div>
                  ) : null}

                  {job.error && !status ? (
                    <div className="ml-9 mt-2 text-[11px] leading-4 text-[var(--mac-secondary)]">
                      {job.error}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3 text-[12px] text-[var(--mac-secondary)]">
            Start a download from a stream result.
          </div>
        )}
      </div>

      {activeJobs ? (
        <div className="mt-1 px-1 text-[11px] text-[var(--mac-secondary)]">
          {activeJobs} active {activeJobs === 1 ? 'download' : 'downloads'}
        </div>
      ) : null}
    </AppModal>
  )
}
