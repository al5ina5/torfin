import { isTauri } from '@tauri-apps/api/core'

import type { StreamResult } from '../types'

export function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return (
    isTauri()
    || Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  )
}

function apiHeaders(path: string) {
  const key = String(import.meta.env.VITE_SERVER_API_KEY || '').trim()
  const headers: Record<string, string> = {}
  if (key && path.startsWith('/api/')) headers.Authorization = `Bearer ${key}`
  return headers
}

let apiRequestTimeoutMs = 15000

export function setApiRequestTimeoutSeconds(seconds: number) {
  apiRequestTimeoutMs = Math.max(5, seconds) * 1000
}

export async function loadJson<T>(url: string): Promise<T> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>('fetch_json', { url })
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), apiRequestTimeoutMs)
  try {
    const response = await fetch(`/api/fetch-json?url=${encodeURIComponent(url)}`, {
      headers: apiHeaders('/api/fetch-json'),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.error || `${response.status} ${response.statusText}`)
    }
    return payload as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Refresh or try another source.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function postApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...apiHeaders(path) },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || `${response.status} ${response.statusText}`)
  return payload as T
}

export async function getApi<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: apiHeaders(path) })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || `${response.status} ${response.statusText}`)
  return payload as T
}

export async function resolveStreamUrl(token: string, stream: StreamResult, directUrl?: string) {
  if (directUrl) return directUrl
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<string>('resolve_torbox_stream', {
      token,
      infoHash: stream.infoHash ?? null,
      fileIdx: stream.fileIdx ?? null,
      filename: stream.title,
      directUrl: stream.url ?? null,
    })
  }
  const body = await postApi<{ url: string }>('/api/resolve-torbox-stream', {
    token,
    infoHash: stream.infoHash ?? null,
    fileIdx: stream.fileIdx ?? null,
    filename: stream.title,
    directUrl: stream.url ?? null,
  })
  return body.url
}
