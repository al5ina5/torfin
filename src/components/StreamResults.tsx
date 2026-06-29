import { ChevronDown, ChevronUp, Download, Loader2, Play, RefreshCw, Zap } from 'lucide-react'

import { isStreamCached } from '../lib/streams'

import {
  canDownload,
  canPlayStream,
  compactStreamTitle,
  downloadActionTitle,
  playActionTitle,
  streamMetaSummary,
  streamSourceLabel,
} from '../lib/streams-display'
import type { ResultProfile, StreamResult } from '../types'

type StreamResultsProps = {
  profileStreams: StreamResult[]
  compactStreams: StreamResult[]
  loading: boolean
  profile: ResultProfile
  profileOptions: Array<{ id: ResultProfile; label: string; description?: string }>
  onProfileChange: (profile: ResultProfile) => void
  resultsExpanded: boolean
  onToggleExpanded: () => void
  emptyMessage: string
  onRefresh: () => void
  resolvingKey: string
  downloadingKey: string
  torboxApiKey: string
  onPlay: (stream: StreamResult, index: number) => void
  onDownload: (stream: StreamResult, index: number) => void
}

export function StreamResults({
  profileStreams,
  compactStreams,
  loading,
  profile,
  profileOptions,
  onProfileChange,
  resultsExpanded,
  onToggleExpanded,
  emptyMessage,
  onRefresh,
  resolvingKey,
  downloadingKey,
  torboxApiKey,
  onPlay,
  onDownload,
}: StreamResultsProps) {
  const visibleStreams = resultsExpanded ? profileStreams : compactStreams
  const hasMoreResults = profileStreams.length > compactStreams.length

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-normal">Stream Results</h3>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="grid size-7 shrink-0 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] transition hover:bg-[var(--mac-control-hover)]"
          title="Refresh results"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-[var(--mac-border)] bg-[var(--mac-control)] p-0.5">
        {profileOptions.map((result) => (
          <button
            key={result.id}
            type="button"
            onClick={() => onProfileChange(result.id)}
            title={result.description || undefined}
            className={`h-7 shrink-0 rounded-md px-2 text-[11px] font-semibold transition ${
              profile === result.id
                ? 'bg-[var(--mac-elevated)] text-[var(--mac-text)] shadow-sm'
                : 'text-[var(--mac-secondary)] hover:bg-[var(--mac-control-hover)]'
            }`}
          >
            {result.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid h-20 place-items-center rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)]">
          <Loader2 className="animate-spin text-[var(--mac-accent)]" />
        </div>
      ) : profileStreams.length || compactStreams.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--mac-secondary)]">
            <span>
              Showing {visibleStreams.length} of {profileStreams.length}
            </span>
            {hasMoreResults ? (
              <button
                type="button"
                onClick={onToggleExpanded}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 font-semibold transition hover:bg-[var(--mac-control-hover)]"
              >
                {resultsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {resultsExpanded ? 'Less' : 'More'}
              </button>
            ) : null}
          </div>

          <div className="divide-y divide-[var(--mac-border)]">
            {visibleStreams.map((stream, index) => {
              const key = `${stream.pluginName}-${stream.infoHash ?? stream.url ?? stream.title}-${index}`
              const playable = canPlayStream(stream, torboxApiKey)
              const downloadable = canDownload(stream)
              const title = compactStreamTitle(stream)
              const meta = streamMetaSummary(stream)
              const source = streamSourceLabel(stream)
              const detail =
                source.toLowerCase() === stream.pluginName.toLowerCase()
                  ? meta
                  : [meta, source].filter(Boolean).join(' · ')
              const cached = isStreamCached(stream)
              return (
                <article
                  key={`${stream.pluginName}-${stream.title}-${index}`}
                  className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition hover:bg-[var(--mac-control)]/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate text-[13px] font-semibold leading-4 text-[var(--mac-text)]" title={title}>
                        {title}
                      </h4>
                      {cached ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] font-semibold leading-none text-emerald-700 dark:text-emerald-300 bg-emerald-500/15"
                          title="Cached on Torbox — instant play"
                        >
                          <Zap size={9} fill="currentColor" />
                          Cached
                        </span>
                      ) : null}
                    </div>
                    {detail ? (
                      <p className="mt-0.5 truncate text-[11px] leading-4 text-[var(--mac-secondary)]" title={detail}>
                        {detail}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      disabled={!downloadable || downloadingKey === key}
                      onClick={() => onDownload(stream, index)}
                      className="grid size-6 place-items-center rounded-full text-[var(--mac-tertiary)] transition hover:bg-[var(--mac-control)] hover:text-[var(--mac-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                      title={downloadable ? downloadActionTitle(torboxApiKey, stream) : 'No downloadable data'}
                    >
                      {downloadingKey === key ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
                    </button>
                    <button
                      type="button"
                      disabled={!playable || resolvingKey === key}
                      onClick={() => onPlay(stream, index)}
                      className="grid size-6 place-items-center rounded-full bg-[var(--mac-accent)] text-[var(--mac-accent-text)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[var(--mac-control)] disabled:text-[var(--mac-tertiary)]"
                      title={playActionTitle(stream, torboxApiKey)}
                    >
                      {resolvingKey === key ? (
                        <Loader2 className="animate-spin" size={13} />
                      ) : (
                        <Play size={13} className="ml-px" fill="currentColor" />
                      )}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] px-3 py-2 text-[12px] leading-4 text-[var(--mac-secondary)]">
          {emptyMessage}
        </div>
      )}

    </div>
  )
}
