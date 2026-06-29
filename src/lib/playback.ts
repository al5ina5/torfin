import { isTauriRuntime, postApi } from './api'
import type { MediaInfo } from '../types'

const BROWSER_PLAYABLE_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.m3u8', '.webm']
const NON_BROWSER_EXTENSIONS = ['.mkv', '.avi']

export function isTorboxCdnUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().includes('tb-cdn.st')
  } catch {
    return false
  }
}

export function resolvePlaybackUrl(url: string) {
  if (!url || url.startsWith('http://') || url.startsWith('https://')) return url
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.href).href
}

export function isBrowserPlayableUrl(url: string) {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  })()

  if (NON_BROWSER_EXTENSIONS.some((extension) => path.endsWith(extension))) return false
  if (BROWSER_PLAYABLE_EXTENSIONS.some((extension) => path.endsWith(extension))) return true
  return false
}

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
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<string>('start_hls_transcode', {
      url: sourceUrl,
      audioStreamIndex,
      subtitleStreamIndex,
    })
  }

  const body = await postApi<{ url: string }>('/api/start-hls-transcode', {
    url: sourceUrl,
    audioStreamIndex,
    subtitleStreamIndex,
  })
  return body.url
}

export function needsTranscodeFallback(sourceUrl: string, playbackUrl: string) {
  return Boolean(sourceUrl) && Boolean(playbackUrl) && playbackUrl === sourceUrl
}

export function shouldTranscodeDirectly(sourceUrl: string, audioIndex: number | null, subtitleIndex: number | null) {
  if (audioIndex !== null || subtitleIndex !== null) return true
  if (!isBrowserPlayableUrl(sourceUrl)) return true
  if (!isTauriRuntime() && isTorboxCdnUrl(sourceUrl)) return true
  return false
}

export function canRetryPlaybackWithTranscode(sourceUrl: string) {
  return Boolean(sourceUrl?.trim())
}

export function isRetriablePlaybackError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('FFmpeg exited before the stream was ready')
    || message.includes('did not produce a playable stream in time')
    || message.includes('Error opening input')
    || message.includes('Connection reset')
    || message.includes('HTTP error')
    || message.includes('Upstream returned HTTP')
  )
}
export function playbackUnavailableMessage() {
  if (isTauriRuntime()) {
    return 'This stream is not playable. Install FFmpeg (brew install ffmpeg) or try another result.'
  }
  return 'This stream is not playable in the browser. Ensure FFmpeg is installed on the server (included in the Docker image), or try another result.'
}
