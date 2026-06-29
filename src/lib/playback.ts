import { isTauriRuntime, postApi } from './api'
import type { HlsTranscodeProgress, HlsTranscodeResult, MediaInfo } from '../types'

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
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke<MediaInfo>('inspect_media', { url: sourceUrl })
    } catch {
      return null
    }
  }

  try {
    return await postApi<MediaInfo>('/api/inspect-media', { url: sourceUrl })
  } catch {
    return null
  }
}

export async function startHlsTranscode(
  sourceUrl: string,
  audioStreamIndex: number | null = null,
  subtitleStreamIndex: number | null = null,
  startSeconds = 0,
): Promise<HlsTranscodeResult> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const url = await invoke<string>('start_hls_transcode', {
      url: sourceUrl,
      audioStreamIndex,
      subtitleStreamIndex,
    })
    return { url, mediaOffset: startSeconds }
  }

  return postApi<HlsTranscodeResult>('/api/start-hls-transcode', {
    url: sourceUrl,
    audioStreamIndex,
    subtitleStreamIndex,
    startSeconds,
  })
}

export function isTranscodePlaybackUrl(url: string) {
  return url.includes('/api/hls-transcode/') || url.includes('hls-transcode')
}

export function transcodeSessionId(url: string) {
  const match = url.match(/\/api\/hls-transcode\/([^/]+)\//)
  return match?.[1] ?? null
}

export async function seekHlsTranscode(sessionId: string, time: number): Promise<HlsTranscodeResult> {
  if (isTauriRuntime()) {
    throw new Error('Seek is not supported in the desktop app yet.')
  }

  return postApi<HlsTranscodeResult>(`/api/hls-transcode/${sessionId}/seek`, { time })
}

export async function getHlsTranscodeProgress(): Promise<HlsTranscodeProgress> {
  const idle: HlsTranscodeProgress = {
    active: false,
    segmentCount: 0,
    playlistReady: false,
    transcodedSeconds: 0,
    processRunning: false,
    duration: null,
  }

  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke<HlsTranscodeProgress>('get_hls_transcode_progress')
    } catch {
      return idle
    }
  }

  try {
    const response = await fetch('/api/hls-transcode-progress')
    if (!response.ok) return idle
    return await response.json() as HlsTranscodeProgress
  } catch {
    return idle
  }
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
