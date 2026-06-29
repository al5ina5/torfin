import type { PluginConfig } from '../types'
import { INDEXER_ORDER, OPTIONAL_INDEXER_IDS, PRIMARY_INDEXER_IDS, indexerDescription, optionalIndexerSetupHint } from '../lib/indexer-labels'
import { pluginNeedsTorboxKey } from '../lib/plugins'

type StreamIndexerSettingsProps = {
  plugins: PluginConfig[]
  onUpdatePlugin: (pluginId: string, patch: Partial<PluginConfig>) => void
  onPluginEnabledChange: (plugin: PluginConfig, enabled: boolean) => void
}

function IndexerCard({
  plugin,
  onUpdatePlugin,
  onPluginEnabledChange,
}: {
  plugin: PluginConfig
  onUpdatePlugin: StreamIndexerSettingsProps['onUpdatePlugin']
  onPluginEnabledChange: StreamIndexerSettingsProps['onPluginEnabledChange']
}) {
  const needsTorbox = pluginNeedsTorboxKey(plugin)
  const setupHint = optionalIndexerSetupHint(plugin.id)
  const isOptional = OPTIONAL_INDEXER_IDS.includes(plugin.id as (typeof OPTIONAL_INDEXER_IDS)[number])
  const missingTemplate = isOptional && !plugin.streamUrlTemplate.trim()

  return (
    <div className="rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{plugin.name}</div>
          <p className="mt-0.5 text-[10px] leading-4 text-[var(--mac-secondary)]">{indexerDescription(plugin.id)}</p>
          {needsTorbox ? (
            <p className="mt-0.5 text-[10px] text-[var(--mac-tertiary)]">Requires Torbox in Connected Services.</p>
          ) : null}
          {setupHint ? (
            <p className="mt-1 text-[10px] leading-4 text-[var(--mac-tertiary)]">{setupHint}</p>
          ) : null}
          {missingTemplate && plugin.enabled ? (
            <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">Paste your stream URL before results will load.</p>
          ) : null}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[12px] font-medium">
          <input
            checked={plugin.enabled}
            onChange={(event) => onPluginEnabledChange(plugin, event.target.checked)}
            type="checkbox"
            className="size-4 accent-[var(--mac-accent)]"
            disabled={missingTemplate && !plugin.enabled}
          />
          {plugin.enabled ? 'On' : 'Off'}
        </label>
      </div>
      {(isOptional || plugin.streamUrlTemplate.includes('{')) && (
        <details className="group mt-2">
          <summary className="cursor-pointer text-[10px] font-semibold text-[var(--mac-tertiary)] marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Endpoint URL</span>
            <span className="hidden group-open:inline">Hide endpoint URL</span>
          </summary>
          <textarea
            value={plugin.streamUrlTemplate}
            onChange={(event) => onUpdatePlugin(plugin.id, { streamUrlTemplate: event.target.value })}
            rows={isOptional ? 3 : 2}
            spellCheck={false}
            placeholder={
              isOptional
                ? 'https://your-instance/stream/movie/{imdbId}.json'
                : undefined
            }
            className="mt-1.5 w-full resize-none rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] px-2 py-1.5 font-mono text-[10px] leading-4 outline-none focus:border-[var(--mac-accent)]"
          />
        </details>
      )}
    </div>
  )
}

export function StreamIndexerSettings({
  plugins,
  onUpdatePlugin,
  onPluginEnabledChange,
}: StreamIndexerSettingsProps) {
  const pluginsById = new Map(plugins.map((plugin) => [plugin.id, plugin]))
  const primaryPlugins = PRIMARY_INDEXER_IDS
    .map((id) => pluginsById.get(id))
    .filter((plugin): plugin is PluginConfig => Boolean(plugin))
  const optionalPlugins = OPTIONAL_INDEXER_IDS
    .map((id) => pluginsById.get(id))
    .filter((plugin): plugin is PluginConfig => Boolean(plugin))
  const legacyPlugins = INDEXER_ORDER
    .filter((id) => !PRIMARY_INDEXER_IDS.includes(id as (typeof PRIMARY_INDEXER_IDS)[number]) && !OPTIONAL_INDEXER_IDS.includes(id as (typeof OPTIONAL_INDEXER_IDS)[number]))
    .map((id) => pluginsById.get(id))
    .filter((plugin): plugin is PluginConfig => Boolean(plugin))

  return (
    <div className="space-y-2">
      {primaryPlugins.map((plugin) => (
        <IndexerCard
          key={plugin.id}
          plugin={plugin}
          onUpdatePlugin={onUpdatePlugin}
          onPluginEnabledChange={onPluginEnabledChange}
        />
      ))}

      {optionalPlugins.length ? (
        <details className="group rounded-xl border border-[var(--mac-border)] bg-[var(--mac-surface)]/60">
          <summary className="cursor-pointer px-3 py-2.5 text-[12px] font-semibold text-[var(--mac-secondary)] marker:content-none [&::-webkit-details-marker]:hidden">
            More indexers
            <span className="ml-1 font-normal text-[var(--mac-tertiary)]">(AIOStreams, MediaFusion — paste your own config)</span>
          </summary>
          <div className="space-y-2 border-t border-[var(--mac-border)] p-2">
            {optionalPlugins.map((plugin) => (
              <IndexerCard
                key={plugin.id}
                plugin={plugin}
                onUpdatePlugin={onUpdatePlugin}
                onPluginEnabledChange={onPluginEnabledChange}
              />
            ))}
          </div>
        </details>
      ) : null}

      {legacyPlugins.map((plugin) => (
        <IndexerCard
          key={plugin.id}
          plugin={plugin}
          onUpdatePlugin={onUpdatePlugin}
          onPluginEnabledChange={onPluginEnabledChange}
        />
      ))}
    </div>
  )
}
