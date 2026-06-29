import { isTauriRuntime } from './api'
import type { StreamResult } from '../types'

export function canExportTorrent(stream: StreamResult) {
  return Boolean(stream.infoHash || stream.url?.startsWith('magnet:'))
}

export function shouldExportTorrent(torboxApiKey: string, stream: StreamResult) {
  return canExportTorrent(stream) && !torboxApiKey.trim()
}

export function usesMediaImportPath(torboxApiKey: string, stream: StreamResult) {
  if (shouldExportTorrent(torboxApiKey, stream)) return false
  if (stream.url?.startsWith('http') && !stream.infoHash) return true
  return Boolean(torboxApiKey.trim() && canExportTorrent(stream))
}

export function buildMagnetLink(stream: StreamResult) {
  if (stream.url?.startsWith('magnet:')) return stream.url.trim()
  const hash = stream.infoHash?.trim()
  if (!hash) throw new Error('This result does not expose a torrent reference.')
  const name = stream.title.split('\n')[0]?.trim() || 'download'
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function saveTorrentExport(filename: string, magnet: string) {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<string>('save_torrent_export', { filename, content: magnet })
  }

  downloadTextFile(filename, magnet)
  return `~/Downloads/Torfin/torrents/${filename}`
}
