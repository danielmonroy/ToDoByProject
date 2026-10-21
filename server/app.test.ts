import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import net from 'node:net'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createSessionToken } from './auth.ts'
import { createAppHandler, type ServerOptions } from './app.ts'
import { resolveConfig } from './config.ts'

const sampleBoard = {
  version: 1,
  agendaTaskIds: ['t1'],
  projects: [
    {
      id: 'p1',
      name: 'Casa',
      tasks: [
        {
          id: 't1',
          title: 'Regar las plantas',
          completed: false,
          priority: 'p1',
          effort: 'm5',
          timeOfDay: 'morning',
        },
      ],
    },
  ],
}

async function withServer(overrides: Partial<ServerOptions> = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'kanban-'))
  const staticDir = path.join(dataDir, 'static')
  await mkdir(path.join(staticDir, 'assets'), { recursive: true })
  await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>tablero</title>')
  await writeFile(path.join(staticDir, 'assets', 'app.js'), 'console.log(1)\n')

  const options: ServerOptions = {
    password: 'test-password',
    sessionSecret: 'test-session-secret',
    dataDir,
    staticDir,
    trustProxy: false,
    secureCookie: 'auto',
    maxLoginAttempts: 3,
    loginDelayMs: 0,
    ...overrides,
  }

  const handler = createAppHandler(options)
  const server = createServer((req, res) => {
    void handler(req, res).catch((error: unknown) => {
      if (res.headersSent) return
      res.writeHead(500)
      res.end(error instanceof Error ? error.message : 'error')
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('El servidor de prueba no expuso un puerto.')

  return {
    options,
    origin: `http://127.0.0.1:${address.port}`,
    async close() {
      server.close()
      await once(server, 'close')
      await rm(dataDir, { recursive: true, force: true })
    },
  }
}

function rawRequest(origin: string, requestPath: string): Promise<string> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(url.port), url.hostname, () => {
      socket.write(`GET ${requestPath} HTTP/1.1\r\nHost: ${url.host}\r\nConnection: close\r\n\r\n`)
    })
    let data = ''
    socket.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8')
    })
    socket.on('end', () => resolve(data))
    socket.on('error', reject)
  })
}

function sessionCookie(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const parts = headers.getSetCookie?.() ?? []
  const cookie = parts.map((part) => part.split(';')[0] ?? '').join('; ')
  if (!cookie) throw new Error('Falta la cookie de sesión.')
  return cookie
}

async function login(origin: string, password = 'test-password', originHeader?: string): Promise<string> {
  const response = await fetch(`${origin}/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(originHeader ? { origin: originHeader } : {}),
    },
    body: JSON.stringify({ password }),
  })
  assert.equal(response.status, 200)
  return sessionCookie(response)
}

test('la configuración de producción exige una contraseña propia', () => {
  const missing = resolveConfig({ NODE_ENV: 'production' })
  assert.equal('error' in missing, true)

  const example = resolveConfig({
    NODE_ENV: 'production',
    APP_PASSWORD: 'cambia-esta-clave',
    SESSION_SECRET: 'cambia-este-secreto-largo',
  })
  assert.equal('error' in example, true)

  const ready = resolveConfig({
    NODE_ENV: 'production',
    APP_PASSWORD: 'una-clave-larga',
    SESSION_SECRET: 'un-secreto-largo-123',
    PORT: '8080',
    TRUST_PROXY: 'true',
  })
  assert.equal('config' in ready, true)
  if (!('config' in ready)) return
  assert.equal(ready.config.port, 8080)
  assert.equal(ready.config.trustProxy, true)
  assert.equal(ready.config.secureCookie, 'auto')
})

test('el tablero exige sesión y se conserva en disco', async () => {
  const server = await withServer()
  try {
    const anonymous = await fetch(`${server.origin}/api/board`)
    assert.equal(anonymous.status, 401)

    const health = await fetch(`${server.origin}/api/health`)
    assert.equal(health.status, 200)

    const cookie = await login(server.origin)
    const empty = await fetch(`${server.origin}/api/board`, { headers: { cookie } })
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), { board: null })

    const legacy = {
      version: 1,
      projects: [{ id: 'p1', name: 'Casa', tasks: [{ id: 't1', title: 'Regar' }] }],
    }
    const saved = await fetch(`${server.origin}/api/board`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json', origin: server.origin },
      body: JSON.stringify(legacy),
    })
    assert.equal(saved.status, 200)
    const body = (await saved.json()) as { board: { projects: Array<{ tasks: Array<{ completed: boolean }> }> } }
    assert.equal(body.board.projects[0]?.tasks[0]?.completed, false)

    const again = await fetch(`${server.origin}/api/board`, { headers: { cookie } })
    assert.equal(again.status, 200)
    const stored = JSON.parse(await readFile(path.join(server.options.dataDir, 'board.json'), 'utf8')) as {
      projects: Array<{ name: string }>
    }
    assert.equal(stored.projects[0]?.name, 'Casa')

    const invalid = await fetch(`${server.origin}/api/board`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, projects: [{ id: 'x' }] }),
    })
    assert.equal(invalid.status, 400)
    const afterInvalid = JSON.parse(await readFile(path.join(server.options.dataDir, 'board.json'), 'utf8')) as {
      projects: Array<{ name: string }>
    }
    assert.equal(afterInvalid.projects[0]?.name, 'Casa')

    const logoutResponse = await fetch(`${server.origin}/api/logout`, {
      method: 'POST',
      headers: { cookie },
    })
    assert.equal(logoutResponse.status, 200)
    const cleared = sessionCookie(logoutResponse)
    const session = await fetch(`${server.origin}/api/session`, { headers: { cookie: cleared } })
    assert.equal(session.status, 401)
  } finally {
    await server.close()
  }
})

test('un origen distinto no puede reemplazar el tablero', async () => {
  const server = await withServer()
  try {
    const cookie = await login(server.origin)
    const rejected = await fetch(`${server.origin}/api/board`, {
      method: 'PUT',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: 'https://otro-sitio.example',
      },
      body: JSON.stringify(sampleBoard),
    })
    assert.equal(rejected.status, 403)

    const accepted = await fetch(`${server.origin}/api/board`, {
      method: 'PUT',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: server.origin,
      },
      body: JSON.stringify(sampleBoard),
    })
    assert.equal(accepted.status, 200)
  } finally {
    await server.close()
  }
})

test('bloquea intentos de entrada seguidos', async () => {
  const server = await withServer()
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${server.origin}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'no-es' }),
      })
      assert.equal(response.status, 401)
    }

    const limited = await fetch(`${server.origin}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test-password' }),
    })
    assert.equal(limited.status, 429)
  } finally {
    await server.close()
  }
})

test('la cookie segura depende de HTTPS detrás del proxy', async () => {
  const server = await withServer({ trustProxy: true })
  try {
    const plain = await fetch(`${server.origin}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'http' },
      body: JSON.stringify({ password: 'test-password' }),
    })
    const plainCookie = plain.headers.getSetCookie?.()[0] ?? ''
    assert.equal(plainCookie.includes('Secure'), false)
    assert.equal(plainCookie.includes('HttpOnly'), true)

    const secure = await fetch(`${server.origin}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
      body: JSON.stringify({ password: 'test-password' }),
    })
    const secureCookie = secure.headers.getSetCookie?.()[0] ?? ''
    assert.equal(secureCookie.includes('Secure'), true)
  } finally {
    await server.close()
  }
})

test('rechaza una sesión caducada y no deja salir de la carpeta pública', async () => {
  const server = await withServer()
  try {
    const expired = createSessionToken(server.options.sessionSecret, Date.now(), -1000)
    const session = await fetch(`${server.origin}/api/session`, {
      headers: { cookie: `kanban_session=${expired}` },
    })
    assert.equal(session.status, 401)

    const page = await fetch(`${server.origin}/proyectos`)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /tablero/)

    const asset = await fetch(`${server.origin}/assets/app.js`)
    assert.equal(asset.status, 200)

    await writeFile(path.join(server.options.dataDir, 'secret.txt'), 'super-secret-marker')
    const escaped = await rawRequest(server.origin, '/%2e%2e%2fsecret.txt')
    assert.match(escaped, /^HTTP\/1\.1 403/)
    assert.equal(escaped.includes('super-secret-marker'), false)

    const missing = await fetch(`${server.origin}/assets/no-existe.js`)
    assert.equal(missing.status, 404)
  } finally {
    await server.close()
  }
})

test('guarda una copia anterior antes de reemplazar el tablero', async () => {
  const server = await withServer()
  try {
    const cookie = await login(server.origin)
    await fetch(`${server.origin}/api/board`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(sampleBoard),
    })
    const replacement = {
      ...sampleBoard,
      projects: [{ ...sampleBoard.projects[0], name: 'Trabajo' }],
    }
    const saved = await fetch(`${server.origin}/api/board`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(replacement),
    })
    assert.equal(saved.status, 200)
    const backup = JSON.parse(await readFile(path.join(server.options.dataDir, 'board.json.bak'), 'utf8')) as {
      projects: Array<{ name: string }>
    }
    assert.equal(backup.projects[0]?.name, 'Casa')
  } finally {
    await server.close()
  }
})
