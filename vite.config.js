import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

/**
 * Generic CORS proxy mounted directly on the Vite dev server.
 * Lua `net.get`/`net.post`/etc. can pass any absolute URL through
 * `/api/proxy?url=<encoded-url>` and the server will fetch it without
 * browser CORS restrictions.
 */
function genericProxyPlugin() {
  return {
    name: 'generic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res, next) => {
        try {
          const idx = req.url.indexOf('?url=')
          if (idx === -1) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing url query parameter' }))
            return
          }

          const targetUrl = decodeURIComponent(req.url.slice(idx + 5))
          const parsed = new URL(targetUrl)
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Only http/https URLs are allowed' }))
            return
          }

          // Forward whitelisted headers; drop hop-by-hop / host headers.
          const headers = {}
          for (const [key, value] of Object.entries(req.headers)) {
            const lower = key.toLowerCase()
            if (
              lower === 'host' ||
              lower === 'connection' ||
              lower === 'content-length' ||
              lower === 'transfer-encoding' ||
              lower === 'cookie'
            ) {
              continue
            }
            if (value !== undefined) headers[key] = value
          }

          // Read body for non-GET methods.
          let body
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = []
            for await (const chunk of req) {
              chunks.push(chunk)
            }
            body = Buffer.concat(chunks)
            if (body.length === 0) body = undefined
          }

          const upstream = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers,
            body,
          })

          res.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            const lower = key.toLowerCase()
            if (lower === 'content-encoding' || lower === 'transfer-encoding') return
            try {
              res.setHeader(key, value)
            } catch {
              // Ignore invalid header values.
            }
          })

          const data = Buffer.from(await upstream.arrayBuffer())
          res.end(data)
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message || String(err) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['process', 'os', 'fs', 'util', 'path', 'crypto', 'stream', 'buffer'],
      globals: { process: true, Buffer: true },
    }),
    genericProxyPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'tmp': path.resolve(__dirname, './src/bc08/polyfills/tmp.js'),
      'os': path.resolve(__dirname, './src/bc08/polyfills/os.js'),
      'child_process': path.resolve(__dirname, './src/bc08/polyfills/child_process.js'),
      'readline-sync': path.resolve(__dirname, './src/bc08/polyfills/readline-sync.js'),
    },
  },
  optimizeDeps: {
    force: true,
    include: ['fengari', 'fengari-interop', 'tmp', 'readline-sync'],
    esbuildOptions: {
      alias: {
        'tmp': path.resolve(__dirname, './src/bc08/polyfills/tmp.js'),
        'os': path.resolve(__dirname, './src/bc08/polyfills/os.js'),
        'child_process': path.resolve(__dirname, './src/bc08/polyfills/child_process.js'),
        'readline-sync': path.resolve(__dirname, './src/bc08/polyfills/readline-sync.js'),
      },
    },
  },
  server: {
    proxy: {
      '/api/mempool': {
        target: 'https://mempool.space',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/mempool/, '/api'),
      },
      '/api/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/coingecko/, '/api/v3'),
      },
    },
  },
})
