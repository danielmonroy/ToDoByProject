import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { createAppHandler } from './server/app.ts'
import { resolveConfig } from './server/config.ts'
import { loadEnvFile } from './server/env.ts'

function kanbanApi(): Plugin {
  const attach = () => {
    loadEnvFile()
    const resolved = resolveConfig(process.env)
    if ('error' in resolved) {
      throw new Error(resolved.error)
    }

    if (!process.env.APP_PASSWORD) {
      console.warn('APP_PASSWORD no está definida. En desarrollo la contraseña es dev-password.')
    }

    const handler = createAppHandler({ ...resolved.config, staticDir: null })
    return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
      const url = req.url ?? ''
      if (!url.startsWith('/api')) {
        next()
        return
      }

      void handler(req, res).catch((error: unknown) => {
        next(error)
      })
    }
  }

  return {
    name: 'kanban-api',
    configureServer(server) {
      server.middlewares.use(attach())
    },
    configurePreviewServer(server) {
      server.middlewares.use(attach())
    },
  }
}

export default defineConfig({
  plugins: [react(), kanbanApi()],
})
