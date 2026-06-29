import { isTauriRuntime, postApi } from './api'
import type { TorboxAccountSummary } from '../types'

export async function fetchTorboxAccount(apiKey: string): Promise<TorboxAccountSummary> {
  if (!apiKey.trim()) throw new Error('Add your Torbox API key to load account details.')
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<TorboxAccountSummary>('get_torbox_account', { apiKey })
  }
  return postApi<TorboxAccountSummary>('/api/torbox/account', { apiKey })
}
