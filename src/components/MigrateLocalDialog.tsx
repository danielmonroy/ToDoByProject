import { useEffect } from 'react'
import { summarizeBoard } from '../../shared/board'
import type { BoardState } from '../types'

type MigrateLocalDialogProps = {
  localBoard: BoardState
  replacing: boolean
  busy: boolean
  onMigrate: () => void
  onDismiss: () => void
  onDiscard: () => void
}

export function MigrateLocalDialog({
  localBoard,
  replacing,
  busy,
  onMigrate,
  onDismiss,
  onDiscard,
}: MigrateLocalDialogProps) {
  const summary = summarizeBoard(localBoard)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onDismiss])

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="migrate-title">
        <h2 id="migrate-title" className="dialog__title">
          {replacing ? 'Hay otra copia en este navegador' : 'Hay un tablero en este navegador'}
        </h2>
        <p className="dialog__text">
          Encontré {summary.projects} {summary.projects === 1 ? 'proyecto' : 'proyectos'} y {summary.tasks}{' '}
          {summary.tasks === 1 ? 'tarea' : 'tareas'} guardados en este dispositivo.
          {replacing
            ? ' Subirlos reemplaza el tablero que ya está en el servidor.'
            : ' Si los subes, podrás verlos desde cualquier dispositivo.'}
        </p>
        <p className="dialog__text">
          Si la copia está en otro navegador, expórtala desde allí e impórtala con el botón Importar.
        </p>
        <div className="dialog__actions">
          <button className="button" type="button" onClick={onMigrate} disabled={busy} autoFocus>
            {busy ? 'Subiendo…' : replacing ? 'Reemplazar el del servidor' : 'Subir al servidor'}
          </button>
          <button className="button button--secondary" type="button" onClick={onDismiss} disabled={busy}>
            {replacing ? 'Conservar el del servidor' : 'Ahora no'}
          </button>
          <button className="button button--danger" type="button" onClick={onDiscard} disabled={busy}>
            Borrar copia local
          </button>
        </div>
      </div>
    </div>
  )
}
