import { isTauriRuntime } from './api'

export type ClientErrorPayload = {
  message: string
  name?: string
  stack?: string
  kind: 'error' | 'unhandledrejection' | 'react' | 'manual'
  url?: string
  componentStack?: string
  context?: Record<string, unknown>
}

let reportingInstalled = false
const reportedFingerprints = new Set<string>()
const MAX_REPORTS_PER_SESSION = 50

function fingerprint(payload: ClientErrorPayload) {
  const firstFrame = String(payload.stack || '')
    .split('\n')
    .find((line) => line.trim().startsWith('at ')) || ''
  const raw = `${payload.message}\n${firstFrame}`
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return String(hash)
}

function apiHeaders() {
  const key = String(import.meta.env.VITE_SERVER_API_KEY || '').trim()
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

function shouldReport(payload: ClientErrorPayload) {
  if (reportedFingerprints.size >= MAX_REPORTS_PER_SESSION) return false
  const key = fingerprint(payload)
  if (reportedFingerprints.has(key)) return false
  reportedFingerprints.add(key)
  return true
}

export async function reportClientError(payload: ClientErrorPayload) {
  if (!shouldReport(payload)) return
  const body = {
    ...payload,
    url: payload.url || (typeof window !== 'undefined' ? window.location.href : ''),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }

  if (isTauriRuntime()) {
    console.error('[torfin-client-error]', body)
    return
  }

  const json = JSON.stringify(body)
  const needsAuth = Boolean(String(import.meta.env.VITE_SERVER_API_KEY || '').trim())
  try {
    if (
      !needsAuth
      && typeof navigator !== 'undefined'
      && typeof navigator.sendBeacon === 'function'
    ) {
      const blob = new Blob([json], { type: 'application/json' })
      if (navigator.sendBeacon('/api/client-errors', blob)) return
    }
    await fetch('/api/client-errors', {
      method: 'POST',
      headers: apiHeaders(),
      body: json,
      keepalive: true,
    })
  } catch {
    // Never throw from error reporting.
  }
}

export function initClientErrorReporting() {
  if (reportingInstalled || typeof window === 'undefined') return
  reportingInstalled = true

  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement | null
    if (target && target !== window && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      reportClientError({
        kind: 'error',
        message: `Resource failed: ${(target as HTMLImageElement).src || (target as HTMLScriptElement).src || 'unknown'}`,
        name: 'ResourceError',
        context: { tag: target.tagName },
      })
      return
    }
    reportClientError({
      kind: 'error',
      message: event.message || 'Unknown error',
      name: 'Error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportClientError({
      kind: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      name: reason instanceof Error ? reason.name : 'UnhandledRejection',
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
}
