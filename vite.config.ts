import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { normalizeAllowedFetchJsonUrl } from './src/lib/torbox.js'

const API_BACKEND = process.env.TORFIN_API_URL || 'http://127.0.0.1:3020'

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

async function readRawBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Torfin',
        short_name: 'Torfin',
        description: 'Browse and stream your Torbox library.',
        theme_color: '#131315',
        background_color: '#131315',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
    {
      name: 'torfin-dev-api',
      configureServer(server) {
        server.middlewares.use('/api/start-hls-transcode', async (request, response) => {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed' })
            return
          }
          try {
            // @ts-ignore -- untyped JS helper module
            const { startHlsTranscode } = await import('./server/transcode.mjs')
            const body = await readJsonBody(request)
            sendJson(response, 200, {
              url: await startHlsTranscode(body.url, body.audioStreamIndex ?? null, body.subtitleStreamIndex ?? null),
            })
          } catch (error) {
            sendJson(response, 500, { error: error instanceof Error ? error.message : 'Could not start transcoding.' })
          }
        })

        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url || '/', 'http://127.0.0.1')
          if (request.method === 'GET' && url.pathname.startsWith('/api/hls-transcode/')) {
            try {
              // @ts-ignore -- untyped JS helper module
              const { serveHlsTranscodeFile } = await import('./server/transcode.mjs')
              if (serveHlsTranscodeFile(url.pathname, response)) return
              sendJson(response, 404, { error: 'Transcode session not found' })
            } catch (error) {
              sendJson(response, 500, { error: error instanceof Error ? error.message : 'Could not serve transcode output.' })
            }
            return
          }
          return next()
        })

        server.middlewares.use('/api/fetch-json', async (request, response) => {
          try {
            const requestUrl = new URL(request.url || '/', 'http://127.0.0.1')
            const targetUrl = normalizeAllowedFetchJsonUrl(requestUrl.searchParams.get('url'))
            const upstream = await fetch(targetUrl, {
              headers: {
                accept: 'application/json',
                'user-agent': 'Torfin/1.0.0-beta',
              },
            })
            const text = await upstream.text()
            response.statusCode = upstream.status
            response.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
            response.end(text)
          } catch (error) {
            sendJson(response, 500, { error: error instanceof Error ? error.message : 'Fetch failed' })
          }
        })

        server.middlewares.use('/api/torbox/account', async (request, response) => {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed' })
            return
          }
          try {
            // @ts-ignore -- untyped JS helper module
            const { fetchTorboxAccount } = await import('./server/torbox.mjs')
            const body = await readJsonBody(request)
            sendJson(response, 200, await fetchTorboxAccount(body.apiKey))
          } catch (error) {
            sendJson(response, 500, { error: error instanceof Error ? error.message : 'Torbox account lookup failed' })
          }
        })

        server.middlewares.use('/api/resolve-torbox-stream', async (request, response) => {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed' })
            return
          }
          try {
            // @ts-ignore -- untyped JS helper module
            const { resolveTorboxStream } = await import('./server/torbox.mjs')
            const body = await readJsonBody(request)
            sendJson(response, 200, { url: await resolveTorboxStream(body) })
          } catch (error) {
            sendJson(response, 500, { error: error instanceof Error ? error.message : 'Could not resolve Torbox stream.' })
          }
        })

        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url || '/', 'http://127.0.0.1')
          if (!url.pathname.startsWith('/api/')) return next()

          try {
            const target = `${API_BACKEND}${url.pathname}${url.search}`
            const headers: Record<string, string> = {}
            for (const [key, value] of Object.entries(request.headers)) {
              if (!value || ['host', 'connection', 'content-length'].includes(key.toLowerCase())) continue
              headers[key] = Array.isArray(value) ? value.join(', ') : value
            }
            const body = request.method !== 'GET' && request.method !== 'HEAD' ? await readRawBody(request) : undefined
            const upstream = await fetch(target, {
              method: request.method,
              headers,
              body: body?.length ? body : undefined,
            })
            response.statusCode = upstream.status
            upstream.headers.forEach((value, key) => {
              if (key.toLowerCase() === 'transfer-encoding') return
              response.setHeader(key, value)
            })
            response.end(Buffer.from(await upstream.arrayBuffer()))
          } catch (error) {
            const cause = error instanceof Error && 'cause' in error ? (error.cause as NodeJS.ErrnoException) : null
            const refused = cause?.code === 'ECONNREFUSED'
            sendJson(response, refused ? 503 : 500, {
              error: refused
                ? `Download API is not running at ${API_BACKEND}. Start it with: npm run dev:full`
                : error instanceof Error
                  ? error.message
                  : 'API proxy failed',
            })
          }
        })
      },
    },
  ],
})
