import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function contentType(file: string): string {
  return TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
  size: number,
  cacheControl: string,
): void {
  res.writeHead(200, {
    'content-type': contentType(file),
    'content-length': size,
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'x-frame-options': 'DENY',
  })

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  createReadStream(file).pipe(res)
}

export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  pathname: string,
): Promise<void> {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }

  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    res.writeHead(400)
    res.end()
    return
  }

  if (decoded.includes('\0')) {
    res.writeHead(400)
    res.end()
    return
  }

  const rootResolved = path.resolve(root)
  const requested = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const file = path.resolve(rootResolved, requested)
  const inside = file === rootResolved || file.startsWith(`${rootResolved}${path.sep}`)

  if (!inside) {
    res.writeHead(403)
    res.end()
    return
  }

  const found = await stat(file).catch(() => null)
  if (found?.isFile()) {
    const cached = path.extname(file) === '.html' ? 'no-cache' : file.includes(`${path.sep}assets${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600'
    sendFile(req, res, file, found.size, cached)
    return
  }

  if (path.extname(requested)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end(method === 'HEAD' ? undefined : 'No encontrado.')
    return
  }

  const index = path.join(rootResolved, 'index.html')
  const indexStat = await stat(index).catch(() => null)
  if (!indexStat?.isFile()) {
    res.writeHead(404, { 'cache-control': 'no-store' })
    res.end()
    return
  }

  sendFile(req, res, index, indexStat.size, 'no-cache')
}
