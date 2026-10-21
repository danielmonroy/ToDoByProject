import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createAppHandler } from '../server/app.ts'
import { parseMigrateArgs, runMigrate } from './migrate.ts'

const board = {
  version: 1,
  agendaTaskIds: [],
  projects: [
    {
      id: 'p1',
      name: 'Viaje',
      tasks: [{ id: 't1', title: 'Comprar billetes', completed: false }],
    },
  ],
}

test('parsea las opciones de la migración', () => {
  const args = parseMigrateArgs(['--file', 'tablero.json', '--out=./data/board.json', '--force'])
  assert.equal('error' in args, false)
  if ('error' in args) return
  assert.equal(args.file, 'tablero.json')
  assert.equal(args.out, './data/board.json')
  assert.equal(args.force, true)

  const unknown = parseMigrateArgs(['--no-existe'])
  assert.equal('error' in unknown, true)
})

test('escribe board.json y no pisa un archivo existente sin --force', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'kanban-migrate-'))
  const source = path.join(directory, 'kanban-board.json')
  const target = path.join(directory, 'board.json')
  await writeFile(source, JSON.stringify(board))

  try {
    const first = await runMigrate({
      args: ['--file', source, '--out', target],
      stdout: () => undefined,
      stderr: () => undefined,
    })
    assert.equal(first, 0)
    const written = JSON.parse(await readFile(target, 'utf8')) as { projects: Array<{ name: string }> }
    assert.equal(written.projects[0]?.name, 'Viaje')

    const logs: string[] = []
    const second = await runMigrate({
      args: ['--file', source, '--out', target],
      confirm: async () => false,
      stdout: () => undefined,
      stderr: (line) => logs.push(line),
    })
    assert.equal(second, 1)
    assert.match(logs.join('\n'), /cancelada/)

    const forced = await runMigrate({
      args: ['--file', source, '--out', target, '--force'],
      stdout: () => undefined,
      stderr: () => undefined,
    })
    assert.equal(forced, 0)
    const backup = JSON.parse(await readFile(`${target}.bak`, 'utf8')) as { projects: Array<{ name: string }> }
    assert.equal(backup.projects[0]?.name, 'Viaje')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('sube el archivo a un servidor con contraseña', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'kanban-remote-'))
  const sourceDir = await mkdtemp(path.join(tmpdir(), 'kanban-source-'))
  const source = path.join(sourceDir, 'kanban-board.json')
  await writeFile(source, JSON.stringify(board))

  const handler = createAppHandler({
    password: 'clave-remota',
    sessionSecret: 'secreto-de-prueba',
    dataDir,
    staticDir: null,
    trustProxy: false,
    secureCookie: false,
    loginDelayMs: 0,
  })
  const server = createServer((req, res) => {
    void handler(req, res)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('sin puerto')

  try {
    const code = await runMigrate({
      args: ['--file', source, '--url', `http://127.0.0.1:${address.port}`, '--password', 'clave-remota'],
      stdout: () => undefined,
      stderr: () => undefined,
    })
    assert.equal(code, 0)

    const stored = JSON.parse(await readFile(path.join(dataDir, 'board.json'), 'utf8')) as {
      projects: Array<{ tasks: Array<{ title: string; priority: null }> }>
    }
    assert.equal(stored.projects[0]?.tasks[0]?.title, 'Comprar billetes')
    assert.equal(stored.projects[0]?.tasks[0]?.priority, null)

    const rejected = await runMigrate({
      args: ['--file', source, '--url', `http://127.0.0.1:${address.port}`, '--password', 'otra'],
      stdout: () => undefined,
      stderr: () => undefined,
    })
    assert.equal(rejected, 1)
  } finally {
    server.close()
    await once(server, 'close')
    await rm(dataDir, { recursive: true, force: true })
    await rm(sourceDir, { recursive: true, force: true })
  }
})

test('la simulación no escribe el archivo', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'kanban-dry-'))
  const source = path.join(directory, 'kanban-board.json')
  const target = path.join(directory, 'board.json')
  await writeFile(source, JSON.stringify(board))
  const lines: string[] = []

  try {
    const code = await runMigrate({
      args: ['--file', source, '--out', target, '--dry-run'],
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    })
    assert.equal(code, 0)
    assert.match(lines.join('\n'), /Simulación/)
    await assert.rejects(readFile(target, 'utf8'))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
