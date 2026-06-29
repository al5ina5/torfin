#!/usr/bin/env node
/**
 * Smoke test for Torbox stream resolution against a live server.
 *
 * Usage:
 *   TORBOX_API_KEY=... SERVER_API_KEY=... node scripts/test-torbox-resolve.mjs
 *   TORBOX_API_KEY=... node scripts/test-torbox-resolve.mjs --base http://thinktower.local:3020
 */

import { resolveTorboxStream } from '../server/torbox.mjs'

const baseUrl = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://127.0.0.1:3020'
const serverApiKey = process.env.SERVER_API_KEY || process.env.VITE_SERVER_API_KEY || ''
const torboxApiKey = process.env.TORBOX_API_KEY || ''

if (!torboxApiKey.trim()) {
  console.error('Set TORBOX_API_KEY to run this test.')
  process.exit(1)
}

const catalogUrl = 'https://torrentio.strem.fun/stream/movie/tt0111161.json'
const fetchHeaders = serverApiKey ? { Authorization: `Bearer ${serverApiKey}` } : {}

const catalogResponse = await fetch(`${baseUrl}/api/fetch-json?url=${encodeURIComponent(catalogUrl)}`, {
  headers: fetchHeaders,
})
const catalog = await catalogResponse.json()
if (!catalogResponse.ok) throw new Error(catalog.error || `${catalogResponse.status} ${catalogResponse.statusText}`)

const stream = catalog.streams?.[0]
if (!stream?.infoHash) throw new Error('Torrentio did not return a stream with an info hash.')

const started = Date.now()
const url = await resolveTorboxStream({
  token: torboxApiKey,
  infoHash: stream.infoHash,
  fileIdx: stream.fileIdx ?? 0,
  filename: stream.title,
})
const elapsed = Date.now() - started

if (!/^https?:\/\//.test(url)) throw new Error(`Expected an HTTP URL, got: ${url}`)

console.log(JSON.stringify({
  ok: true,
  elapsedMs: elapsed,
  infoHash: stream.infoHash,
  title: stream.title,
  url: url.replace(/([?&]token=)[^&]+/i, '$1[redacted]'),
}, null, 2))
