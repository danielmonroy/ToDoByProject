import type { BoardState } from './types'

const STORAGE_KEY = 'kanban-board'
const THEME_KEY = 'kanban-theme'
const AGENDA_VISIBLE_KEY = 'kanban-agenda-visible'
const EXPORT_FILENAME = 'kanban-board.json'

export type Theme = 'light' | 'dark'

function createId(): string {
  return crypto.randomUUID()
}

export function createSeedBoard(): BoardState {
  return {
    version: 1,
    agendaTaskIds: [],
    projects: [
      {
        id: createId(),
        name: 'Proyecto A',
        tasks: [
          { id: createId(), title: 'Definir alcance', completed: false, priority: null },
          { id: createId(), title: 'Revisar requisitos', completed: false, priority: null },
        ],
      },
      {
        id: createId(),
        name: 'Proyecto B',
        tasks: [{ id: createId(), title: 'Diseñar wireframes', completed: false, priority: null }],
      },
      {
        id: createId(),
        name: 'Proyecto C',
        tasks: [],
      },
    ],
  }
}

type PersistedBoard = {
  version: 1
  projects: BoardState['projects']
  agendaTaskIds?: string[]
}

function isBoardState(value: unknown): value is PersistedBoard {
  if (!value || typeof value !== 'object') return false

  const board = value as PersistedBoard
  if (board.version !== 1 || !Array.isArray(board.projects)) return false

  if (
    board.agendaTaskIds !== undefined &&
    (!Array.isArray(board.agendaTaskIds) ||
      !board.agendaTaskIds.every((id) => typeof id === 'string'))
  ) {
    return false
  }

  return board.projects.every(
    (project) =>
      typeof project.id === 'string' &&
      typeof project.name === 'string' &&
      Array.isArray(project.tasks) &&
      project.tasks.every(
        (task) =>
          typeof task.id === 'string' &&
          typeof task.title === 'string' &&
          (task.completed === undefined || typeof task.completed === 'boolean') &&
          (task.priority === undefined ||
            task.priority === null ||
            task.priority === 'p1' ||
            task.priority === 'p2' ||
            task.priority === 'p3'),
      ),
  )
}

function collectPendingTaskIds(projects: BoardState['projects']): Set<string> {
  const ids = new Set<string>()
  for (const project of projects) {
    for (const task of project.tasks) {
      if (!task.completed) ids.add(task.id)
    }
  }
  return ids
}

function normalizeAgendaTaskIds(
  projects: BoardState['projects'],
  agendaTaskIds: string[] | undefined,
): string[] {
  if (!agendaTaskIds) return []

  const pending = collectPendingTaskIds(projects)
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const id of agendaTaskIds) {
    if (!pending.has(id) || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }

  return normalized
}

function normalizeBoard(board: PersistedBoard): BoardState {
  const projects = board.projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => ({
      ...task,
      completed: task.completed ?? false,
      priority: task.priority ?? null,
    })),
  }))

  return {
    version: 1,
    projects,
    agendaTaskIds: normalizeAgendaTaskIds(projects, board.agendaTaskIds),
  }
}

export function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeedBoard()

    const parsed: unknown = JSON.parse(raw)
    if (!isBoardState(parsed)) return createSeedBoard()

    if (parsed.projects.length === 0) return createSeedBoard()

    return normalizeBoard(parsed)
  } catch {
    return createSeedBoard()
  }
}

export function saveBoard(board: BoardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      alert(
        'No hay espacio suficiente en localStorage. Exporta tus datos y limpia el almacenamiento del navegador.',
      )
    }
    throw error
  }
}

export function exportBoard(board: BoardState): void {
  const blob = new Blob([JSON.stringify(board, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = EXPORT_FILENAME
  link.click()
  URL.revokeObjectURL(url)
}

export function importBoardFile(file: File): Promise<BoardState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        if (!isBoardState(parsed)) {
          reject(new Error('El archivo no tiene un formato válido.'))
          return
        }
        resolve(normalizeBoard(parsed))
      } catch {
        reject(new Error('No se pudo leer el archivo JSON.'))
      }
    }

    reader.onerror = () => reject(new Error('Error al leer el archivo.'))
    reader.readAsText(file)
  })
}

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Ignore storage errors and fall back to the system preference.
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Theme preference is optional; the UI still works without persistence.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function loadAgendaVisible(): boolean {
  try {
    return localStorage.getItem(AGENDA_VISIBLE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveAgendaVisible(visible: boolean): void {
  try {
    localStorage.setItem(AGENDA_VISIBLE_KEY, String(visible))
  } catch {
    // Visibility is optional; the board still works without it.
  }
}

export { createId }
