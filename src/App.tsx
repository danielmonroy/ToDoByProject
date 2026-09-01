import { useEffect, useRef, useState } from 'react'
import { Board } from './components/Board'
import {
  applyTheme,
  exportBoard,
  importBoardFile,
  loadAgendaVisible,
  loadBoard,
  loadTheme,
  saveAgendaVisible,
  saveBoard,
  saveTheme,
  type Theme,
} from './storage'
import { countPendingAgendaTasks } from './agenda'
import type { BoardState } from './types'
import './App.css'

function App() {
  const [board, setBoard] = useState<BoardState>(() => loadBoard())
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAgenda, setShowAgenda] = useState(() => loadAgendaVisible())
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const importInputRef = useRef<HTMLInputElement>(null)
  const pendingAgendaCount = countPendingAgendaTasks(board)

  useEffect(() => {
    saveBoard(board)
  }, [board])

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    saveAgendaVisible(showAgenda)
  }, [showAgenda])

  const handleExport = () => {
    exportBoard(board)
  }

  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    try {
      const imported = await importBoardFile(file)
      const confirmed = window.confirm(
        '¿Reemplazar el tablero actual con los datos importados?',
      )
      if (confirmed) setBoard(imported)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo importar el archivo.'
      alert(message)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Mapa mental de proyectos y tareas</h1>

        <div className="app__actions">
          <button
            type="button"
            className={`button button--secondary ${theme === 'dark' ? 'button--active' : ''}`}
            onClick={() =>
              setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
            }
            aria-pressed={theme === 'dark'}
          >
            <svg
              className="button__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
            </svg>
            Oscuro
          </button>
          <button
            type="button"
            className={`button button--secondary ${showCompleted ? 'button--active' : ''}`}
            onClick={() => setShowCompleted((value) => !value)}
          >
            Completadas
          </button>
          <button
            type="button"
            className={`button button--secondary ${showAgenda ? 'button--active' : ''}`}
            onClick={() => setShowAgenda((value) => !value)}
            aria-pressed={showAgenda}
          >
            <svg
              className="button__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Orden del día
            {pendingAgendaCount > 0 ? (
              <span className="button__count">{pendingAgendaCount}</span>
            ) : null}
          </button>
          <button type="button" className="button" onClick={handleExport}>
            Exportar
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={handleImportClick}
          >
            Importar
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportFile}
          />
        </div>
      </header>

      <main className="app__main">
        <Board
          board={board}
          showCompleted={showCompleted}
          showAgenda={showAgenda}
          onChange={setBoard}
          onShowAgenda={() => setShowAgenda(true)}
          onHideAgenda={() => setShowAgenda(false)}
        />
      </main>
    </div>
  )
}

export default App
