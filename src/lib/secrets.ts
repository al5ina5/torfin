import { isTauriRuntime } from './api'

const WEB_SECRET_PREFIX = 'torfin.web-secret'

function localKey(key: string) {
  return `${WEB_SECRET_PREFIX}.${key}`
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

async function invokeSecret<T>(command: 'get_secret' | 'set_secret' | 'delete_secret', args: Record<string, unknown>) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

function canFallback(key: string) {
  return (
    key === 'torbox_api_key'
    || key === 'jellyfin_api_key'
    || key === 'ssh_password'
    || key.startsWith('dest_jellyfin_')
    || key.startsWith('dest_ssh_')
  )
}

export async function getSecret(key: string) {
  if (isTauriRuntime()) {
    return invokeSecret<string | null>('get_secret', { key })
  }
  if (!canUseLocalStorage() || !canFallback(key)) return null
  return window.localStorage.getItem(localKey(key))
}

export async function setSecret(key: string, value: string) {
  if (isTauriRuntime()) {
    await invokeSecret<void>('set_secret', { key, value })
    return
  }
  if (!canUseLocalStorage() || !canFallback(key)) return
  window.localStorage.setItem(localKey(key), value)
}

export async function deleteSecret(key: string) {
  if (isTauriRuntime()) {
    await invokeSecret<void>('delete_secret', { key })
    return
  }
  if (!canUseLocalStorage() || !canFallback(key)) return
  window.localStorage.removeItem(localKey(key))
}
