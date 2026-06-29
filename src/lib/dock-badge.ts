import { isTauriRuntime } from './api'

export async function setDockBadge(count: number) {
  if (!isTauriRuntime()) {
    document.title = count > 0 ? `Torfin (${count})` : 'Torfin'
    return
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_dock_badge', { label: count > 0 ? String(count) : null })
  } catch {
    document.title = count > 0 ? `Torfin (${count})` : 'Torfin'
  }
}
