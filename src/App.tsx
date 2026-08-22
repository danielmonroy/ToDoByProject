import { useEffect, useRef, useState } from 'react'
import { Board } from './components/Board'
import {
  exportBoard,
  importBoardFile,
  loadBoard,
  saveBoard,
} from './storage'
import type { BoardState } from './types'
import './App.css'

function App() {
  const [board, setBoard] = useState<BoardState>(() => loadBoard())
  const [showCompleted, setShowCompleted] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveBoard(board)
  }, [board])

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
            className={`button button--secondary ${showCompleted ? 'button--active' : ''}`}
            onClick={() => setShowCompleted((value) => !value)}
          >
            Completadas
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
          onChange={setBoard}
        />
      </main>
    </div>
  )
}

export default App
