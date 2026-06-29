import { Loader2, RefreshCw } from 'lucide-react'
import useSWR from 'swr'

import { fetchTorboxAccount } from '../lib/torbox-account'

type TorboxAccountPanelProps = {
  apiKey: string
}

export function TorboxAccountPanel({ apiKey }: TorboxAccountPanelProps) {
  const { data, error, isLoading, mutate } = useSWR(
    apiKey.trim() ? ['torbox-account', apiKey.trim()] : null,
    () => fetchTorboxAccount(apiKey),
    { revalidateOnFocus: false },
  )

  return (
    <div className="rounded-lg border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold">Torbox Account</div>
        <button
          type="button"
          onClick={() => { void mutate() }}
          disabled={!apiKey.trim() || isLoading}
          className="grid size-7 place-items-center rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] disabled:opacity-50"
          title="Refresh account"
        >
          {isLoading ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}
        </button>
      </div>

      {!apiKey.trim() ? (
        <p className="text-[11px] leading-4 text-[var(--mac-secondary)]">Add your Torbox API key above to see plan and torrent status.</p>
      ) : error ? (
        <p className="text-[11px] leading-4 text-red-600 dark:text-red-300">{error instanceof Error ? error.message : 'Could not load Torbox account.'}</p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md bg-[var(--mac-control)] px-2.5 py-2">
            <div className="text-[var(--mac-tertiary)]">Plan</div>
            <div className="mt-0.5 font-semibold text-[var(--mac-text)]">{data.plan || 'Unknown'}</div>
          </div>
          <div className="rounded-md bg-[var(--mac-control)] px-2.5 py-2">
            <div className="text-[var(--mac-tertiary)]">Torrents</div>
            <div className="mt-0.5 font-semibold text-[var(--mac-text)]">{data.totalTorrents ?? 0}</div>
          </div>
          <div className="rounded-md bg-[var(--mac-control)] px-2.5 py-2">
            <div className="text-[var(--mac-tertiary)]">Active</div>
            <div className="mt-0.5 font-semibold text-[var(--mac-text)]">{data.activeTorrents ?? 0}</div>
          </div>
          <div className="rounded-md bg-[var(--mac-control)] px-2.5 py-2">
            <div className="text-[var(--mac-tertiary)]">Cached</div>
            <div className="mt-0.5 font-semibold text-[var(--mac-text)]">{data.cachedTorrents ?? 0}</div>
          </div>
          {data.email ? (
            <div className="col-span-2 rounded-md bg-[var(--mac-control)] px-2.5 py-2">
              <div className="text-[var(--mac-tertiary)]">Email</div>
              <div className="mt-0.5 truncate font-semibold text-[var(--mac-text)]">{data.email}</div>
            </div>
          ) : null}
          {data.expiresAt ? (
            <div className="col-span-2 text-[var(--mac-secondary)]">Premium expires {data.expiresAt}</div>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--mac-secondary)]">Loading account details…</p>
      )}
    </div>
  )
}
