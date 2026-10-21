import type { IncomingMessage, ServerResponse } from 'node:http'
import { createSessionToken, passwordMatches, verifySessionToken } from './auth.ts'
import type { SecureCookie } from './config.ts'
import { serveStatic } from './static.ts'
import { InvalidBoardError, readBoard, writeBoard } from './store.ts'
import { parseBoard } from '../shared/board.ts'

const COOKIE_NAME = 'kanban_session'
const BODY_LIMIT = 2_000_000
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

export type ServerOptions = {
  password: string
  sessionSecret: string
  dataDir: string
  staticDir: string | null
  trustProxy: boolean
  secureCookie: SecureCookie
  maxLoginAttempts?: number
  loginDelayMs?: number
}

type Attempt = { count: number; resetAt: number }

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'x-frame-options': 'DENY',
  })
  res.end(payload)
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        const error = new Error('too large') as Error & { statusCode?: number }
        error.statusCode = 413
        fail(error)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })

    req.on('error', (error) => {
      fail(error)
    })
  })
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req, BODY_LIMIT)
  if (!raw.trim()) return {}
  return JSON.parse(raw) as unknown
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for']
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
    if (value) return value.split(',')[0]?.trim() || 'unknown'
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function cookieValue(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

function requestHost(req: IncomingMessage, trustProxy: boolean): string | null {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-host']
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
    if (value) return value.split(',')[0]?.trim() ?? null
  }
  return req.headers.host ?? null
}

function originAllowed(req: IncomingMessage, trustProxy: boolean): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  if (Array.isArray(origin)) return false

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }

  return originHost === requestHost(req, trustProxy)
}

function cookieSecure(req: IncomingMessage, options: ServerOptions): boolean {
  if (options.secureCookie === true) return true
  if (options.secureCookie === false) return false
  return options.trustProxy && req.headers['x-forwarded-proto'] === 'https'
}

function setSessionCookie(req: IncomingMessage, res: ServerResponse, options: ServerOptions, token: string | null): void {
  const pieces = [
    `${COOKIE_NAME}=${token ? encodeURIComponent(token) : ''}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    token ? 'Max-Age=2592000' : 'Max-Age=0',
  ]
  if (cookieSecure(req, options)) pieces.push('Secure')
  res.setHeader('set-cookie', pieces.join('; '))
}

function authenticated(req: IncomingMessage, options: ServerOptions): boolean {
  const token = cookieValue(req, COOKIE_NAME)
  if (!token) return false
  return verifySessionToken(options.sessionSecret, token)
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function createAppHandler(options: ServerOptions) {
  const attempts = new Map<string, Attempt>()
  const maxLoginAttempts = options.maxLoginAttempts ?? 8
  const loginDelayMs = options.loginDelayMs ?? 300

  async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
    const method = req.method ?? 'GET'

    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true })
      return
    }

    if (method === 'GET' && pathname === '/api/session') {
      if (!authenticated(req, options)) {
        sendJson(res, 401, { error: 'Necesitas entrar.' })
        return
      }
      sendJson(res, 200, { authenticated: true })
      return
    }

    if (method === 'POST' && pathname === '/api/login') {
      const ip = clientIp(req, options.trustProxy)
      const now = Date.now()
      const current = attempts.get(ip)
      if (current && current.resetAt > now && current.count >= maxLoginAttempts) {
        sendJson(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' })
        return
      }

      let body: unknown
      try {
        body = await readJson(req)
      } catch (error) {
        const status = error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 413 ? 413 : 400
        sendJson(res, status, {
          error: status === 413 ? 'La solicitud es demasiado grande.' : 'No se pudo leer la solicitud.',
        })
        return
      }

      const password = body && typeof body === 'object' && 'password' in body ? body.password : undefined
      if (typeof password !== 'string' || !passwordMatches(password, options.password)) {
        const attempt = current && current.resetAt > now ? current : { count: 0, resetAt: now + ATTEMPT_WINDOW_MS }
        attempt.count += 1
        attempts.set(ip, attempt)
        await delay(loginDelayMs)
        sendJson(res, 401, { error: 'Contraseña incorrecta.' })
        return
      }

      attempts.delete(ip)
      setSessionCookie(req, res, options, createSessionToken(options.sessionSecret))
      sendJson(res, 200, { ok: true })
      return
    }

    if (method === 'POST' && pathname === '/api/logout') {
      setSessionCookie(req, res, options, null)
      sendJson(res, 200, { ok: true })
      return
    }

    if (pathname === '/api/board') {
      if (!authenticated(req, options)) {
        sendJson(res, 401, { error: 'Necesitas entrar.' })
        return
      }

      if (method === 'GET') {
        try {
          const board = await readBoard(options.dataDir)
          sendJson(res, 200, { board })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'No se pudo leer el tablero.'
          sendJson(res, 500, { error: message })
        }
        return
      }

      if (method === 'PUT') {
        if (!originAllowed(req, options.trustProxy)) {
          sendJson(res, 403, { error: 'El origen de la solicitud no está permitido.' })
          return
        }

        let body: unknown
        try {
          body = await readJson(req)
        } catch (error) {
          const status = error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 413 ? 413 : 400
          sendJson(res, status, {
            error: status === 413 ? 'El tablero es demasiado grande.' : 'No se pudo leer el tablero.',
          })
          return
        }

        const parsed = parseBoard(body)
        if (!parsed) {
          sendJson(res, 400, { error: 'El tablero no tiene un formato válido.' })
          return
        }

        try {
          const board = await writeBoard(options.dataDir, parsed)
          sendJson(res, 200, { board })
        } catch (error) {
          if (error instanceof InvalidBoardError) {
            sendJson(res, 400, { error: error.message })
            return
          }
          const message = error instanceof Error ? error.message : 'No se pudo guardar el tablero.'
          sendJson(res, 500, { error: message })
        }
        return
      }
    }

    sendJson(res, 404, { error: 'No encontrado.' })
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname)
      return
    }

    if (!options.staticDir) {
      sendJson(res, 404, { error: 'No encontrado.' })
      return
    }

    await serveStatic(req, res, options.staticDir, url.pathname)
  }
}
