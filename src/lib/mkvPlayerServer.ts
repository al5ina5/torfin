import { isTauriRuntime } from './api'
import { isTranscodePlaybackUrl, resolvePlaybackUrl } from './playback'

export type MkvServerConfig = {
  baseUrl: string
  enabled: boolean
  delivery: 'hls'
}

export function mkvServerBaseUrl() {
  return String(import.meta.env.VITE_MKV_SERVER_URL || 'http://localhost:8787').trim()
}

export function shouldUseMkvServer(sourceUrl: string, playbackUrl: string) {
  if (!sourceUrl || !playbackUrl) return false
  if (isTranscodePlaybackUrl(playbackUrl)) return false
  const resolvedSource = resolvePlaybackUrl(sourceUrl)
  const resolvedPlayback = resolvePlaybackUrl(playbackUrl)
  return resolvedSource === resolvedPlayback
}

export function mkvPlayerServer(sourceUrl: string, playbackUrl: string): MkvServerConfig {
  const enabled = !isTauriRuntime() && shouldUseMkvServer(sourceUrl, playbackUrl)
  return {
    baseUrl: mkvServerBaseUrl(),
    enabled,
    delivery: 'hls',
  }
}
