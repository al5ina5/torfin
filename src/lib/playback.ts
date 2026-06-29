import { isTauriRuntime } from './api'
import type { MediaInfo } from '../types'

export async function inspectMedia(sourceUrl: string): Promise<MediaInfo | null> {
  if (!isTauriRuntime()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<MediaInfo>('inspect_media', { url: sourceUrl })
  } catch {
    return null
  }
}

export async function startHlsTranscode(
  sourceUrl: string,
  audioStreamIndex: number | null = null,
  subtitleStreamIndex: number | null = null,
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('Transcoding requires the desktop app and FFmpeg.')
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('start_hls_transcode', {
    url: sourceUrl,
    audioStreamIndex,
    subtitleStreamIndex,
  })
}

export function needsTranscodeFallback(sourceUrl: string, playbackUrl: string) {
  return isTauriRuntime() && Boolean(sourceUrl) && playbackUrl === sourceUrl
}
