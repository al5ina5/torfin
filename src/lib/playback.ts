import { isTauriRuntime, postApi } from './api'
import type { MediaInfo } from '../types'

const BROWSER_PLAYABLE_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.m3u8', '.webm']
const NON_BROWSER_EXTENSIONS = ['.mkv', '.avi']

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
  return !isBrowserPlayableUrl(sourceUrl)
}

export function playbackUnavailableMessage() {
  if (isTauriRuntime()) {
    return 'This stream is not playable. Install FFmpeg (brew install ffmpeg) or try another result.'
  }
  return 'This stream is not playable in the browser. Run npm run dev:full with FFmpeg installed, use the desktop app (npm run tauri:dev), or try another result.'
}
