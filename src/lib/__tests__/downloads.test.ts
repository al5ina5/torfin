import { describe, expect, it } from 'vitest'

import type { DownloadJob, DownloadStatus } from '../../types'
import {
  bytesLabel,
  dedupeDownloadJobs,
  downloadJobFromStatus,
  downloadJobKey,
  downloadSidebarSummary,
  downloadStatusLabel,
  etaLabel,
  isActiveDownloadJob,
  isFinishedDownloadJob,
  isJellyfinImportConfirmed,
  jellyfinSyncConfigured,
  makeDownloadFilename,
  makeMovieFolderName,
  mergeServerDownloadJobs,
  sortDownloadJobs,
} from '../downloads'

function makeJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    movie: { id: 'tt1', type: 'movie', name: 'Test Movie', releaseInfo: '2024', poster: '', description: '' },
    stream: { pluginName: 'Torrentio', title: '1080p', tags: ['1080p'], rank: 1 },
    ...overrides,
  }
}

function makeStatus(overrides: Partial<DownloadStatus> = {}): DownloadStatus {
  return {
    id: 'job-1',
    name: 'Test Movie (2024) - 1080p.mkv',
    state: 'downloading',
    progress: 50,
    size: 1000,
    downloaded: 500,
    speed: 100,
    eta: 60,
    complete: false,
    engine: 'wget',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('isActiveDownloadJob', () => {
  it('treats in-progress jobs as active', () => {
    expect(isActiveDownloadJob(makeJob({ status: makeStatus() }))).toBe(true)
  })

  it('treats completed and errored jobs as inactive', () => {
    expect(isActiveDownloadJob(makeJob({ status: makeStatus({ complete: true }) }))).toBe(false)
    expect(isActiveDownloadJob(makeJob({ status: makeStatus({ state: 'error:failed' }) }))).toBe(false)
  })

  it('treats jobs without status as inactive', () => {
    expect(isActiveDownloadJob(makeJob())).toBe(false)
  })
})

describe('isFinishedDownloadJob', () => {
  it('treats complete, error, and job.error as finished', () => {
    expect(isFinishedDownloadJob(makeJob({ status: makeStatus({ complete: true }) }))).toBe(true)
    expect(isFinishedDownloadJob(makeJob({ status: makeStatus({ state: 'error:boom' }) }))).toBe(true)
    expect(isFinishedDownloadJob(makeJob({ error: 'failed' }))).toBe(true)
  })
})

describe('downloadStatusLabel', () => {
  it('returns queued when no status and no error', () => {
    expect(downloadStatusLabel(makeJob())).toBe('queued')
  })

  it('returns failed for error states', () => {
    expect(downloadStatusLabel(makeJob({ status: makeStatus({ state: 'error:timeout' }) }))).toBe('failed')
    expect(downloadStatusLabel(makeJob({ error: 'x' }))).toBe('failed')
  })

  it('returns paused for paused active jobs', () => {
    expect(downloadStatusLabel(makeJob({ paused: true, status: makeStatus() }))).toBe('paused')
  })

  it('returns jellyfin label when import confirmed', () => {
    expect(
      downloadStatusLabel(
        makeJob({
          status: makeStatus({
            complete: true,
            jellyfinImportedAt: '2024-01-02',
            jellyfinItemId: 'abc',
          }),
        }),
      ),
    ).toBe('available in jellyfin')
  })
})

describe('sortDownloadJobs', () => {
  const old = makeJob({ pendingId: 'old', createdAt: '2024-01-01T00:00:00.000Z', status: makeStatus({ id: 'old' }) })
  const newJob = makeJob({ pendingId: 'new', createdAt: '2024-06-01T00:00:00.000Z', status: makeStatus({ id: 'new' }) })

  it('sorts newest first by default', () => {
    expect(sortDownloadJobs([old, newJob], 'newest').map((j) => j.pendingId)).toEqual(['new', 'old'])
  })

  it('sorts oldest first when requested', () => {
    expect(sortDownloadJobs([old, newJob], 'oldest').map((j) => j.pendingId)).toEqual(['old', 'new'])
  })

  it('prioritizes active jobs when sort is active', () => {
    const active = makeJob({ pendingId: 'active', status: makeStatus({ id: 'active' }) })
    const done = makeJob({ pendingId: 'done', status: makeStatus({ id: 'done', complete: true }) })
    expect(sortDownloadJobs([done, active], 'active')[0].pendingId).toBe('active')
  })
})

describe('dedupeDownloadJobs', () => {
  it('removes duplicate jobs by key', () => {
    const a = makeJob({ pendingId: 'dup', status: makeStatus({ id: 'dup' }) })
    const b = makeJob({ pendingId: 'dup', status: makeStatus({ id: 'dup' }) })
    expect(dedupeDownloadJobs([a, b])).toHaveLength(1)
  })
})

describe('downloadJobKey', () => {
  it('prefers status id over pending id', () => {
    expect(downloadJobKey(makeJob({ pendingId: 'p', status: makeStatus({ id: 's' }) }))).toBe('s')
    expect(downloadJobKey(makeJob({ pendingId: 'p' }))).toBe('p')
  })
})

describe('mergeServerDownloadJobs', () => {
  it('merges server statuses into local jobs', () => {
    const local = makeJob({ pendingId: 'job-1', status: makeStatus({ id: 'job-1', progress: 10 }) })
    const server = [makeStatus({ id: 'job-1', progress: 80 }), makeStatus({ id: 'job-2', name: 'Other.mkv' })]
    const merged = mergeServerDownloadJobs([local], server)
    expect(merged).toHaveLength(2)
    expect(merged[0].status?.progress).toBe(80)
  })

  it('excludes dismissed ids', () => {
    const server = [makeStatus({ id: 'job-1' })]
    expect(mergeServerDownloadJobs([], server, new Set(['job-1']))).toHaveLength(0)
  })
})

describe('downloadJobFromStatus', () => {
  it('parses movie name and year from folder', () => {
    const job = downloadJobFromStatus(
      makeStatus({ name: 'Inception (2010) - 1080p.mkv', savePath: '/movies/Inception (2010)' }),
    )
    expect(job.movie.name).toBe('Inception')
    expect(job.movie.releaseInfo).toBe('2010')
  })
})

describe('jellyfinSyncConfigured', () => {
  it('requires refresh flag and credentials', () => {
    expect(
      jellyfinSyncConfigured(
        makeJob({
          pollConfig: { mode: 'local', jellyfin: { baseUrl: 'http://j', apiKey: 'k', refreshOnComplete: true } },
        }),
      ),
    ).toBe(true)
    expect(
      jellyfinSyncConfigured(
        makeJob({ pollConfig: { mode: 'local', jellyfin: { baseUrl: '', apiKey: 'k', refreshOnComplete: true } } }),
      ),
    ).toBe(false)
  })
})

describe('isJellyfinImportConfirmed', () => {
  it('requires both importedAt and itemId', () => {
    expect(isJellyfinImportConfirmed({ jellyfinImportedAt: 'x', jellyfinItemId: 'y' } as DownloadStatus)).toBe(true)
    expect(isJellyfinImportConfirmed({ jellyfinImportedAt: 'x' } as DownloadStatus)).toBe(false)
  })
})

describe('makeDownloadFilename', () => {
  it('includes quality and plugin name', () => {
    const movie = { id: 'tt1', type: 'movie' as const, name: 'Film', releaseInfo: '', poster: '', description: '' }
    const stream = { pluginName: 'Torrentio', title: '1080p', tags: ['1080p'], rank: 1 }
    expect(makeDownloadFilename(movie, stream)).toBe('Film - 1080p - Torrentio.mkv')
  })

  it('includes episode tag for series', () => {
    const movie = { id: 'tt2', type: 'series' as const, name: 'Show', releaseInfo: '', poster: '', description: '' }
    const stream = { pluginName: 'Comet', title: '720p', tags: ['720p'], rank: 1 }
    expect(makeDownloadFilename(movie, stream, { season: 1, episode: 3 })).toBe('Show S01E03 - 720p - Comet.mkv')
  })
})

describe('makeMovieFolderName', () => {
  it('adds release year and season folder for episodes', () => {
    const movie = { id: 'tt1', type: 'series' as const, name: 'Show', releaseInfo: '2020', poster: '', description: '' }
    expect(makeMovieFolderName(movie, { season: 2, episode: 1 })).toBe('Show (2020)/Season 2')
  })
})

describe('bytesLabel', () => {
  it('formats byte sizes', () => {
    expect(bytesLabel(0)).toBe('0 B')
    expect(bytesLabel(1024)).toBe('1.0 KB')
    expect(bytesLabel(1_500_000)).toMatch(/MB/)
  })

  it('handles invalid input', () => {
    expect(bytesLabel(NaN)).toBe('0 B')
    expect(bytesLabel(-1)).toBe('0 B')
  })
})

describe('etaLabel', () => {
  it('formats eta strings', () => {
    expect(etaLabel(30)).toBe('30s')
    expect(etaLabel(120)).toBe('2m')
    expect(etaLabel(3700)).toMatch(/1h/)
    expect(etaLabel(-1)).toBe('ETA unknown')
    expect(etaLabel(9_999_999)).toBe('ETA unknown')
  })
})

describe('downloadSidebarSummary', () => {
  it('counts active and resolving jobs', () => {
    const jobs = [
      makeJob({ status: makeStatus({ progress: 40 }) }),
      makeJob({ pendingId: 'q' }),
      makeJob({ status: makeStatus({ complete: true, id: 'done' }) }),
    ]
    const summary = downloadSidebarSummary(jobs)
    expect(summary.activeCount).toBe(1)
    expect(summary.topProgress).toBe(40)
    expect(summary.resolvingCount).toBe(1)
  })
})
