import { isTauriRuntime, postApi } from './api'
import type { ContentType, JellyfinLibraryMatch, StreamResult } from '../types'

type LookupArgs = {
  baseUrl: string
  apiKey: string
  imdbId: string
  contentType: ContentType
  season?: number
  episode?: number
}

function streamQualityFromText(text: string) {
  const haystack = text.toLowerCase()
  if (haystack.includes('2160') || haystack.includes('4k') || haystack.includes('uhd')) return 2160
  if (haystack.includes('1080')) return 1080
  if (haystack.includes('720')) return 720
  if (haystack.includes('480')) return 480
  return 0
}

export function streamTargetQuality(stream: StreamResult) {
  return streamQualityFromText(`${stream.title} ${stream.description ?? ''}`)
}

export function compareQuality(existingHeight: number, targetQuality: number) {
  if (!existingHeight || !targetQuality) return { isUpgrade: false, label: existingHeight ? `${existingHeight}p` : 'In library' }
  const isUpgrade = targetQuality > existingHeight
  const label = existingHeight >= 2160 ? '4K' : `${existingHeight}p`
  return { isUpgrade, label }
}

export async function lookupJellyfinLibrary(args: LookupArgs): Promise<JellyfinLibraryMatch | null> {
  const { baseUrl, apiKey, imdbId, contentType, season, episode } = args
  if (!baseUrl.trim() || !apiKey.trim() || !imdbId.trim()) return null

  const tauri = isTauriRuntime()
  const result = tauri
    ? await import('@tauri-apps/api/core').then(({ invoke }) =>
        invoke<JellyfinLibraryMatch | null>('lookup_jellyfin_library', {
          baseUrl,
          apiKey,
          imdbId,
          contentType,
          season: season ?? null,
          episode: episode ?? null,
        }),
      )
    : await postApi<JellyfinLibraryMatch | null>('/api/jellyfin/lookup', {
        baseUrl,
        apiKey,
        imdbId,
        contentType,
        season,
        episode,
      })

  return result ?? null
}

export function jellyfinPlayUrl(baseUrl: string, itemId: string) {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base || !itemId) return ''
  return `${base}/web/index.html#!/details?id=${encodeURIComponent(itemId)}`
}
