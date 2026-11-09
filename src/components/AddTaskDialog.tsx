import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Project, TaskEffort, TaskPriority, TaskTimeOfDay } from '../types'
import { TaskMetaButtons } from './TaskMetaButtons'

export type NewAgendaTask = {
  projectId: string
  title: string
  priority: TaskPriority | null
  effort: TaskEffort | null
  timeOfDay: TaskTimeOfDay | null
}

type AddTaskDialogProps = {
  projects: Project[]
  initialProjectId: string | null
  onClose: () => void
  onSubmit: (task: NewAgendaTask) => void
}

function initialProjectId(projects: Project[], preferredId: string | null): string {
  if (preferredId && projects.some((project) => project.id === preferredId)) return preferredId
  return projects[0]?.id ?? ''
}

export function AddTaskDialog({
  projects,
  initialProjectId: preferredProjectId,
  onClose,
  onSubmit,
}: AddTaskDialogProps) {
  const titleId = useId()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(() => initialProjectId(projects, preferredProjectId))
  const [priority, setPriority] = useState<TaskPriority | null>(null)
  const [effort, setEffort] = useState<TaskEffort | null>(null)
  const [timeOfDay, setTimeOfDay] = useState<TaskTimeOfDay | null>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const canSubmit = title.trim().length > 0 && projectId.length > 0

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed || !projectId) return
    onSubmit({
      projectId,
      title: trimmed,
      priority,
      effort,
      timeOfDay,
    })
  }

  return createPortal(
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="dialog dialog--task"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="dialog__title">
          Nueva tarea
        </h2>
        {projects.length === 0 ? (
          <>
            <p className="dialog__text">
              Crea un proyecto en el tablero para poder agregar tareas desde Enfoque.
            </p>
            <div className="dialog__actions">
              <button className="button" type="button" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <p className="dialog__text">
              Se agrega al proyecto que elijas y al orden del día.
            </p>
            <label className="field">
              <span className="field__label">Tarea</span>
              <textarea
                ref={titleRef}
                className="field__input field__input--area"
                rows={3}
                value={title}
                placeholder="Qué hay que hacer"
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submit()
                  }
                }}
              />
            </label>
            <label className="field">
              <span className="field__label">Proyecto</span>
              <select
                className="field__input"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <TaskMetaButtons
              layout="fields"
              priority={priority}
              effort={effort}
              timeOfDay={timeOfDay}
              onSetPriority={setPriority}
              onSetEffort={setEffort}
              onSetTimeOfDay={setTimeOfDay}
            />
            <div className="dialog__actions">
              <button className="button" type="submit" disabled={!canSubmit}>
                Agregar
              </button>
              <button className="button button--secondary" type="button" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
