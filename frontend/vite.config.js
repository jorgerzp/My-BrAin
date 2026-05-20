import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

// Debe coincidir EXACTAMENTE con el nombre del repositorio en GitHub (ruta de GitHub Pages).
// Repo: My_BrAIn_v2 → https://usuario.github.io/My_BrAIn_v2/
const GITHUB_PAGES_BASE = '/My_BrAIn_v2/'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devApiPortFile = path.join(__dirname, '../backend/server/.dev-api-port')

function readBackendPort() {
  try {
    const n = parseInt(fs.readFileSync(devApiPortFile, 'utf8').trim(), 10)
    if (n > 0 && n < 65536) return n
  } catch {
    /* archivo aún no creado (backend no arrancado) */
  }
  return 3001
}

/** Reenvía /api al puerto real del backend (escrito en backend/server/.dev-api-port). */
function mybrainApiProxy() {
  return {
    name: 'mybrain-api-proxy',
    enforce: 'pre',
    configureServer(viteServer) {
      viteServer.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) return next()

        const port = readBackendPort()
        const headers = { ...req.headers, host: `127.0.0.1:${port}` }
        delete headers.connection

        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: req.url,
            method: req.method,
            headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
            proxyRes.pipe(res)
          }
        )
        proxyReq.on('error', () => {
          if (!res.headersSent) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                error: `Backend no responde en 127.0.0.1:${port}. Arranca el API (npm run dev en la carpeta backend) o revisa backend/server/.dev-api-port.`,
              })
            )
          }
        })
        req.pipe(proxyReq)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : GITHUB_PAGES_BASE,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [mybrainApiProxy(), react(), tailwindcss()],
  server: {
    port: 5275,
    strictPort: true,
  },
}))
