import { boardFingerprint, parseBoard } from '../shared/board'
import type { BoardState } from './types'

const STORAGE_KEY = 'kanban-board'
const THEME_KEY = 'kanban-theme'
const AGENDA_VISIBLE_KEY = 'kanban-agenda-visible'
const MIGRATE_DISMISS_KEY = 'kanban-local-migrate-dismissed'
const EXPORT_FILENAME = 'kanban-board.json'

export type Theme = 'light' | 'dark'

export function loadLocalBoard(): BoardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseBoard(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearLocalBoard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(MIGRATE_DISMISS_KEY)
  } catch {
    // The server copy remains the source of truth.
  }
}

export function isLocalMigrationDismissed(board: BoardState): boolean {
  try {
    return localStorage.getItem(MIGRATE_DISMISS_KEY) === boardFingerprint(board)
  } catch {
    return false
  }
}

export function dismissLocalMigration(board: BoardState): void {
  try {
    localStorage.setItem(MIGRATE_DISMISS_KEY, boardFingerprint(board))
  } catch {
    // Hiding the prompt is optional.
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
        const board = parseBoard(parsed)
        if (!board) {
          reject(new Error('El archivo no tiene un formato válido.'))
          return
        }
        resolve(board)
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
