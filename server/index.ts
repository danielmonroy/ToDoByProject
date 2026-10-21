import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { resolveConfig } from './config.ts'
import { loadEnvFile } from './env.ts'
import { createAppHandler } from './app.ts'
import { assertDataDirWritable, dropRootForDataDir } from './privileges.ts'

loadEnvFile()

const resolved = resolveConfig(process.env)
if ('error' in resolved) {
  console.error(resolved.error)
  process.exit(1)
}

const { config } = resolved

if (config.isProduction === false && !process.env.APP_PASSWORD) {
  console.warn('APP_PASSWORD no está definida. En desarrollo la contraseña es dev-password.')
}

try {
  dropRootForDataDir(config.dataDir)
  assertDataDirWritable(config.dataDir)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo preparar la carpeta de datos.')
  process.exit(1)
}

if (!existsSync(config.staticDir)) {
  console.error(`No existe la interfaz compilada en ${config.staticDir}. Ejecuta npm run build.`)
  process.exit(1)
}

const handler = createAppHandler(config)
const server = createServer((req, res) => {
  void handler(req, res).catch((error: unknown) => {
    console.error(error)
    if (res.headersSent) return
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Error interno.' }))
  })
})

server.listen(config.port, config.host, () => {
  console.log(`Tablero escuchando en ${config.host}:${config.port}`)
  console.log(`Datos en ${config.dataDir}`)
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
