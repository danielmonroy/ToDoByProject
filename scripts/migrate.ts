import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseBoard, summarizeBoard } from '../shared/board.ts'
import { readBoardFile, writeBoardFile } from '../server/store.ts'
import type { BoardState } from '../src/types.ts'

const HELP = `Migra un tablero exportado al servidor o a un archivo board.json.

Uso:
  npm run migrate -- --file kanban-board.json --url https://tu-dominio --password "$APP_PASSWORD"
  npm run migrate -- --file kanban-board.json --out ./data/board.json

Opciones:
  --file       JSON exportado con el botón Exportar, o el contenido de localStorage
  --url        Origen del servidor, por ejemplo https://tareas.ejemplo.com
  --password   Contraseña de acceso. Si se omite, se usa APP_PASSWORD
  --out        Ruta del archivo de destino, normalmente ./data/board.json
  --force      Reemplaza datos existentes sin preguntar
  --dry-run    Valida el archivo y muestra el resumen, sin escribir
  --help       Muestra esta ayuda

En el servidor, los datos viven en DATA_DIR/board.json. Puedes copiar el archivo
generado con --out a esa carpeta y reiniciar la app.
`

type CliArgs = {
  help: boolean
  file?: string
  url?: string
  password?: string
  out?: string
  force: boolean
  dryRun: boolean
}

export function parseMigrateArgs(argv: string[]): CliArgs | { error: string } {
  const args: CliArgs = { help: false, force: false, dryRun: false }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? ''
    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }
    if (token === '--force') {
      args.force = true
      continue
    }
    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }

    const names = ['--file', '--url', '--password', '--out'] as const
    const name = names.find((item) => token === item || token.startsWith(`${item}=`))
    if (!name) return { error: `Opción desconocida: ${token}` }

    const value = token.includes('=') ? token.slice(name.length + 1) : argv[index + 1]
    if (!token.includes('=')) index += 1
    if (!value || value.startsWith('--')) return { error: `Falta el valor de ${name}.` }

    if (name === '--file') args.file = value
    if (name === '--url') args.url = value
    if (name === '--password') args.password = value
    if (name === '--out') args.out = value
  }

  return args
}

function summaryLine(board: BoardState): string {
  const summary = summarizeBoard(board)
  const projects = summary.projects === 1 ? 'proyecto' : 'proyectos'
  const tasks = summary.tasks === 1 ? 'tarea' : 'tareas'
  return `${summary.projects} ${projects} y ${summary.tasks} ${tasks}`
}

function cookieHeader(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const parts = headers.getSetCookie?.() ?? []
  if (parts.length === 0) {
    const single = response.headers.get('set-cookie')
    if (single) parts.push(single)
  }
  return parts.map((part) => part.split(';')[0] ?? '').filter(Boolean).join('; ')
}

async function defaultConfirm(message: string): Promise<boolean> {
  if (!stdin.isTTY) return false
  const prompt = readline.createInterface({ input: stdin, output: stdout })
  try {
    const answer = (await prompt.question(`${message} [s/N] `)).trim().toLowerCase()
    return answer === 's' || answer === 'si' || answer === 'sí'
  } finally {
    prompt.close()
  }
}

export async function runMigrate(options: {
  args: string[]
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  confirm?: (message: string) => Promise<boolean>
  stdout?: (line: string) => void
  stderr?: (line: string) => void
}): Promise<number> {
  const log = options.stdout ?? ((line: string) => console.log(line))
  const error = options.stderr ?? ((line: string) => console.error(line))
  const parsed = parseMigrateArgs(options.args)

  if ('error' in parsed) {
    error(parsed.error)
    error('Usa --help para ver las opciones.')
    return 1
  }

  if (parsed.help) {
    log(HELP.trimEnd())
    return 0
  }

  if (!parsed.file) {
    error('Indica el archivo con --file.')
    return 1
  }

  if (!parsed.url && !parsed.out) {
    error('Indica --url para subirlo a un servidor, --out para escribir board.json, o ambos.')
    return 1
  }

  const env = options.env ?? process.env
  const password = parsed.password ?? env.APP_PASSWORD
  if (parsed.url && !password) {
    error('Falta la contraseña. Pásala con --password o con la variable APP_PASSWORD.')
    return 1
  }

  let origin = ''
  if (parsed.url) {
    let url: URL
    try {
      url = new URL(parsed.url)
    } catch {
      error('La URL no es válida. Usa el origen, por ejemplo https://tareas.ejemplo.com.')
      return 1
    }
    if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
      error('La URL tiene que ser solo el origen, sin ruta. Ejemplo: https://tareas.ejemplo.com')
      return 1
    }
    origin = url.origin
  }

  let raw: string
  try {
    raw = await readFile(parsed.file, 'utf8')
  } catch {
    error(`No se pudo leer ${parsed.file}.`)
    return 1
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    error('El archivo no es JSON válido.')
    return 1
  }

  const board = parseBoard(json)
  if (!board) {
    error('El archivo no tiene un tablero válido.')
    return 1
  }

  log(`Tablero listo para migrar: ${summaryLine(board)}.`)
  if (parsed.dryRun) {
    log('Simulación terminada. No se escribió nada.')
    return 0
  }

  const confirm = options.confirm ?? defaultConfirm
  const needsConfirm: string[] = []

  if (parsed.out && existsSync(parsed.out)) {
    const existing = await readBoardFile(parsed.out).catch(() => undefined)
    if (existing === undefined) {
      error(`${parsed.out} ya existe y no es un tablero válido. No se ha modificado.`)
      return 1
    }
    if (existing) needsConfirm.push(`${parsed.out} ya tiene un tablero (${summaryLine(existing)})`)
  }

  let sessionCookie = ''
  const fetchImpl = options.fetchImpl ?? fetch
  if (parsed.url && password) {
    let loginResponse: Response
    try {
      loginResponse = await fetchImpl(`${origin}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
    } catch {
      error(`No se pudo conectar con ${origin}.`)
      return 1
    }

    if (loginResponse.status === 401) {
      error('El servidor rechazó la contraseña.')
      return 1
    }
    if (!loginResponse.ok) {
      error(`No se pudo entrar (${loginResponse.status}).`)
      return 1
    }

    sessionCookie = cookieHeader(loginResponse)
    if (!sessionCookie) {
      error('El servidor no inició sesión.')
      return 1
    }

    const currentResponse = await fetchImpl(`${origin}/api/board`, {
      headers: { cookie: sessionCookie },
    })
    if (!currentResponse.ok) {
      error(`No se pudo leer el tablero del servidor (${currentResponse.status}).`)
      return 1
    }
    const current = (await currentResponse.json()) as { board?: unknown }
    const remote = parseBoard(current.board)
    if (remote && (summarizeBoard(remote).projects > 0 || summarizeBoard(remote).tasks > 0)) {
      needsConfirm.push(`el servidor ya tiene un tablero (${summaryLine(remote)})`)
    }
  }

  if (needsConfirm.length > 0 && !parsed.force) {
    const accepted = await confirm(`Esto reemplaza datos existentes: ${needsConfirm.join('; ')}. ¿Continuar?`)
    if (!accepted) {
      error('Migración cancelada. Usa --force para reemplazar sin preguntar.')
      return 1
    }
  }

  if (parsed.out) {
    await writeBoardFile(path.resolve(parsed.out), board)
    log(`Archivo escrito en ${path.resolve(parsed.out)}.`)
  }

  if (parsed.url) {
    const response = await fetchImpl(`${origin}/api/board`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie,
      },
      body: JSON.stringify(board),
    })
    if (!response.ok) {
      error(`No se pudo guardar en el servidor (${response.status}).`)
      return 1
    }
    log(`Tablero subido a ${origin}.`)
  }

  return 0
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  runMigrate({ args: process.argv.slice(2) })
    .then((code) => {
      process.exitCode = code
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'No se pudo migrar.')
      process.exitCode = 1
    })
}
