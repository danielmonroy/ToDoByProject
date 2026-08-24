import type { BoardState } from './types'

const STORAGE_KEY = 'kanban-board'
const EXPORT_FILENAME = 'kanban-board.json'

function createId(): string {
  return crypto.randomUUID()
}

export function createSeedBoard(): BoardState {
  return {
    version: 1,
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

function isBoardState(value: unknown): value is BoardState {
  if (!value || typeof value !== 'object') return false

  const board = value as BoardState
  if (board.version !== 1 || !Array.isArray(board.projects)) return false

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

function normalizeBoard(board: BoardState): BoardState {
  return {
    ...board,
    projects: board.projects.map((project) => ({
      ...project,
      tasks: project.tasks.map((task) => ({
        ...task,
        completed: task.completed ?? false,
        priority: task.priority ?? null,
      })),
    })),
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

export { createId }
