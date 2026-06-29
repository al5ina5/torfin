import { isTauriRuntime } from './api'

export type NativePlayerResult = {
  player: string
  mode: 'external' | 'window'
}

export function isMacTauri() {
  if (!isTauriRuntime() || typeof navigator === 'undefined') return false
  return /Mac|macOS/i.test(navigator.platform || navigator.userAgent)
}

export async function supportsNativePlayer() {
  if (!isMacTauri()) return false
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<boolean>('supports_native_player')
  } catch {
    return false
  }
}

export async function openNativePlayer(url: string, title: string) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<NativePlayerResult>('open_native_player', { url, title })
}
