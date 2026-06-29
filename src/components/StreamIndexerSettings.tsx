import type { PluginConfig } from '../types'
import { INDEXER_ORDER, indexerDescription } from '../lib/indexer-labels'
import { pluginNeedsTorboxKey } from '../lib/plugins'

type StreamIndexerSettingsProps = {
  plugins: PluginConfig[]
  onUpdatePlugin: (pluginId: string, patch: Partial<PluginConfig>) => void
  onPluginEnabledChange: (plugin: PluginConfig, enabled: boolean) => void
}

export function StreamIndexerSettings({
  plugins,
  onUpdatePlugin,
  onPluginEnabledChange,
}: StreamIndexerSettingsProps) {
  const pluginsById = new Map(plugins.map((plugin) => [plugin.id, plugin]))
  const orderedPlugins = INDEXER_ORDER
    .map((id) => pluginsById.get(id))
    .filter((plugin): plugin is PluginConfig => Boolean(plugin))

  return (
    <div className="space-y-2">
      {orderedPlugins.map((plugin) => {
        const needsTorbox = pluginNeedsTorboxKey(plugin)

        return (
          <div key={plugin.id} className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">{plugin.name}</div>
                <p className="mt-0.5 text-[10px] leading-4 text-[var(--mac-secondary)]">{indexerDescription(plugin.id)}</p>
                {needsTorbox ? (
                  <p className="mt-0.5 text-[10px] text-[var(--mac-tertiary)]">Requires Torbox in Connected Services.</p>
                ) : null}
              </div>
              <label className="flex shrink-0 items-center gap-2 text-[12px] font-medium">
                <input
                  checked={plugin.enabled}
                  onChange={(event) => onPluginEnabledChange(plugin, event.target.checked)}
                  type="checkbox"
                  className="size-4 accent-[var(--mac-accent)]"
                />
                {plugin.enabled ? 'On' : 'Off'}
              </label>
            </div>
            <details className="group mt-2">
              <summary className="cursor-pointer text-[10px] font-semibold text-[var(--mac-tertiary)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Endpoint URL</span>
                <span className="hidden group-open:inline">Hide endpoint URL</span>
              </summary>
              <textarea
                value={plugin.streamUrlTemplate}
                onChange={(event) => onUpdatePlugin(plugin.id, { streamUrlTemplate: event.target.value })}
                rows={2}
                spellCheck={false}
                className="mt-1.5 w-full resize-none rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 py-1.5 font-mono text-[10px] leading-4 outline-none focus:border-[var(--mac-accent)]"
              />
            </details>
          </div>
        )
      })}
    </div>
  )
}
