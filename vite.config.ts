import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { normalizeAllowedFetchJsonUrl } from './src/lib/torbox.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'torfin-dev-json-proxy',
      configureServer(server) {
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
            response.statusCode = 500
            response.setHeader('content-type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Fetch failed' }))
          }
        })
      },
    },
  ],
})
