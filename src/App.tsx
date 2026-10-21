import { useCallback, useEffect, useRef, useState } from 'react'
import { Board } from './components/Board'
import { LoginScreen } from './components/LoginScreen'
import { MigrateLocalDialog } from './components/MigrateLocalDialog'
import { fetchBoard, fetchSession, isUnauthorized, logout, putBoard } from './api'
import { countPendingAgendaTasks } from './agenda'
import { boardsEqual, emptyBoard, summarizeBoard } from '../shared/board'
import {
  applyTheme,
  clearLocalBoard,
  dismissLocalMigration,
  exportBoard,
  importBoardFile,
  isLocalMigrationDismissed,
  loadAgendaVisible,
  loadLocalBoard,
  loadTheme,
  saveAgendaVisible,
  saveTheme,
  type Theme,
} from './storage'
import { useServerSync } from './useServerSync'
import type { BoardState } from './types'
import './App.css'

type Phase = 'checking' | 'login' | 'ready'

function App() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [bootError, setBootError] = useState<string | null>(null)

  const checkSession = useCallback(() => {
    return fetchSession().then(
      () => {
        setBootError(null)
        setPhase('ready')
      },
      (error: unknown) => {
        if (isUnauthorized(error)) {
          setPhase('login')
          return
        }
        setBootError(error instanceof Error ? error.message : 'No se pudo conectar.')
      },
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSession().then(
      () => {
        if (!cancelled) setPhase('ready')
      },
      (error: unknown) => {
        if (cancelled) return
        if (isUnauthorized(error)) {
          setPhase('login')
          return
        }
        setBootError(error instanceof Error ? error.message : 'No se pudo conectar.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'login') {
    return <LoginScreen onSuccess={() => setPhase('ready')} />
  }

  if (phase === 'ready') {
    return <BoardScreen onLogout={() => setPhase('login')} />
  }

  return (
    <div className="gate">
      <div className="panel">
        <h1 className="panel__title">Mapa mental de proyectos y tareas</h1>
        <p className="panel__text">{bootError ?? 'Cargando…'}</p>
        {bootError ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              setBootError(null)
              setPhase('checking')
              void checkSession()
            }}
          >
            Reintentar
          </button>
        ) : null}
      </div>
    </div>
  )
}

function BoardScreen({ onLogout }: { onLogout: () => void }) {
  const [board, setBoard] = useState<BoardState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAgenda, setShowAgenda] = useState(() => loadAgendaVisible())
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [localBoard, setLocalBoard] = useState<BoardState | null>(null)
  const [migrateOpen, setMigrateOpen] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [serverHasData, setServerHasData] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const onLogoutRef = useRef(onLogout)

  useEffect(() => {
    onLogoutRef.current = onLogout
  })

  const { sync, unsaved, retry, markSaved, flush } = useServerSync({
    board,
    enabled: board !== null,
    onUnauthorized: () => onLogoutRef.current(),
  })

  const applyRemoteBoard = useCallback(
    (remote: BoardState | null) => {
      const next = remote ?? emptyBoard()
      markSaved(next)
      setBoard(next)
      setServerHasData(remote !== null && (summarizeBoard(remote).projects > 0 || summarizeBoard(remote).tasks > 0))

      const local = loadLocalBoard()
      if (!local) {
        setLocalBoard(null)
        setMigrateOpen(false)
        return
      }

      if (remote && boardsEqual(local, remote)) {
        clearLocalBoard()
        setLocalBoard(null)
        setMigrateOpen(false)
        return
      }

      setLocalBoard(local)
      setMigrateOpen(!isLocalMigrationDismissed(local))
    },
    [markSaved],
  )

  const load = useCallback(() => {
    return fetchBoard().then(applyRemoteBoard, (error: unknown) => {
      if (isUnauthorized(error)) {
        onLogoutRef.current()
        return
      }
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el tablero.')
    })
  }, [applyRemoteBoard])

  useEffect(() => {
    let cancelled = false
    fetchBoard().then(
      (remote) => {
        if (!cancelled) applyRemoteBoard(remote)
      },
      (error: unknown) => {
        if (cancelled) return
        if (isUnauthorized(error)) {
          onLogoutRef.current()
          return
        }
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el tablero.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [applyRemoteBoard])

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    saveAgendaVisible(showAgenda)
  }, [showAgenda])

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (unsaved || sync === 'saving' || sync === 'error') {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [sync, unsaved])

  const handleMigrate = async () => {
    if (!localBoard) return
    setMigrating(true)
    try {
      const saved = await putBoard(localBoard)
      markSaved(saved)
      setBoard(saved)
      setServerHasData(summarizeBoard(saved).projects > 0 || summarizeBoard(saved).tasks > 0)
      clearLocalBoard()
      setLocalBoard(null)
      setMigrateOpen(false)
    } catch (error) {
      if (isUnauthorized(error)) {
        onLogoutRef.current()
        return
      }
      const message = error instanceof Error ? error.message : 'No se pudo subir la copia local.'
      alert(message)
    } finally {
      setMigrating(false)
    }
  }

  const handleDismissMigrate = () => {
    if (localBoard) dismissLocalMigration(localBoard)
    setMigrateOpen(false)
  }

  const handleDiscardLocal = () => {
    const confirmed = window.confirm(
      '¿Borrar la copia guardada en este navegador? El tablero del servidor no se modifica.',
    )
    if (!confirmed) return
    clearLocalBoard()
    setLocalBoard(null)
    setMigrateOpen(false)
  }

  const handleLogout = async () => {
    await flush()
    try {
      await logout()
    } finally {
      onLogout()
    }
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const imported = await importBoardFile(file)
      const confirmed = window.confirm('¿Reemplazar el tablero del servidor con los datos importados?')
      if (!confirmed) return
      setBoard(imported)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar el archivo.'
      alert(message)
    }
  }

  if (loadError) {
    return (
      <div className="gate">
        <div className="panel">
          <h1 className="panel__title">No se pudo cargar el tablero</h1>
          <p className="panel__text">{loadError}</p>
          <div className="dialog__actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setLoadError(null)
                void load()
              }}
            >
              Reintentar
            </button>
            <button className="button button--secondary" type="button" onClick={() => void handleLogout()}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="gate">
        <div className="panel">
          <h1 className="panel__title">Mapa mental de proyectos y tareas</h1>
          <p className="panel__text">Cargando tablero…</p>
        </div>
      </div>
    )
  }

  const pendingAgendaCount = countPendingAgendaTasks(board)
  const syncLabel =
    sync === 'error'
      ? 'No se pudo guardar'
      : sync === 'saving' || unsaved
        ? 'Guardando…'
        : sync === 'saved'
          ? 'Guardado en el servidor'
          : ''

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__heading">
          <h1 className="app__title">Mapa mental de proyectos y tareas</h1>
          {syncLabel ? (
            <p className={`app__sync ${sync === 'error' ? 'app__sync--error' : ''}`} aria-live="polite">
              {syncLabel}
              {sync === 'error' ? (
                <button className="button button--secondary" type="button" onClick={retry}>
                  Reintentar
                </button>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="app__actions">
          <button
            type="button"
            className={`button button--secondary ${theme === 'dark' ? 'button--active' : ''}`}
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
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
            {pendingAgendaCount > 0 ? <span className="button__count">{pendingAgendaCount}</span> : null}
          </button>
          {localBoard && !migrateOpen ? (
            <button className="button button--secondary" type="button" onClick={() => setMigrateOpen(true)}>
              Subir copia local
            </button>
          ) : null}
          <button type="button" className="button" onClick={() => exportBoard(board)}>
            Exportar
          </button>
          <button type="button" className="button button--secondary" onClick={() => importInputRef.current?.click()}>
            Importar
          </button>
          <button type="button" className="button button--secondary" onClick={() => void handleLogout()}>
            Salir
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void handleImportFile(event)}
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

      {migrateOpen && localBoard ? (
        <MigrateLocalDialog
          localBoard={localBoard}
          replacing={serverHasData}
          busy={migrating}
          onMigrate={() => void handleMigrate()}
          onDismiss={handleDismissMigrate}
          onDiscard={handleDiscardLocal}
        />
      ) : null}
    </div>
  )
}

export default App
