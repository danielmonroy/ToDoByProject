import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskPriority } from '../types'
import { getNextPriority, getPriorityLabel } from '../taskPriority'

type TaskCardProps = {
  task: Task
  draggable?: boolean
  sortableId?: string
  dragType?: 'task' | 'agenda-task'
  projectName?: string
  inAgenda?: boolean
  allowDragWhenCompleted?: boolean
  deleteLabel?: string
  onUpdate: (title: string) => void
  onSetPriority: (priority: TaskPriority | null) => void
  onToggleComplete: () => void
  onDelete: () => void
  onToggleAgenda?: () => void
}

export function TaskCard({
  task,
  draggable = true,
  sortableId,
  dragType = 'task',
  projectName,
  inAgenda = false,
  allowDragWhenCompleted = false,
  deleteLabel = 'Eliminar tarea',
  onUpdate,
  onSetPriority,
  onToggleComplete,
  onDelete,
  onToggleAgenda,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId ?? task.id,
    data: { type: dragType, taskId: task.id },
    disabled: !draggable || (task.completed && !allowDragWhenCompleted),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const resizeInput = () => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }

  useEffect(() => {
    if (!isEditing) return
    resizeInput()
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  useEffect(() => {
    if (isEditing) resizeInput()
  }, [draft, isEditing])

  useEffect(() => {
    if (!isEditing) setDraft(task.title)
  }, [task.title, isEditing])

  const save = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      onDelete()
      return
    }
    onUpdate(trimmed)
    setIsEditing(false)
  }

  const cancel = () => {
    setDraft(task.title)
    setIsEditing(false)
  }

  const handlePriorityClick = () => {
    onSetPriority(getNextPriority(task.priority))
  }

  const canDrag = draggable && (!task.completed || allowDragWhenCompleted)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? 'task-card--dragging' : ''} ${task.completed ? 'task-card--completed' : ''} ${inAgenda ? 'task-card--in-agenda' : ''}`}
    >
      <div className="task-card__body">
        {projectName ? (
          <p className="task-card__project">{projectName}</p>
        ) : null}
        {isEditing ? (
          <textarea
            ref={inputRef}
            className="task-card__input"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                save()
              }
              if (event.key === 'Escape') cancel()
            }}
          />
        ) : (
          <button
            type="button"
            className="task-card__title"
            onClick={() => setIsEditing(true)}
          >
            {task.title}
          </button>
        )}
      </div>

      <div className="task-card__toolbar">
        {canDrag ? (
          <button
            type="button"
            className="task-card__drag-handle"
            aria-label="Arrastrar tarea"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        ) : (
          <span className="task-card__drag-placeholder" aria-hidden="true" />
        )}

        <input
          type="checkbox"
          className="task-card__checkbox"
          checked={task.completed}
          onChange={onToggleComplete}
          aria-label={
            task.completed
              ? 'Marcar tarea como pendiente'
              : 'Marcar tarea como completada'
          }
        />

        <button
          type="button"
          className={`task-card__priority ${task.priority ? `task-card__priority--${task.priority}` : 'task-card__priority--none'}`}
          onClick={handlePriorityClick}
          aria-label={`${getPriorityLabel(task.priority)}. Clic para cambiar.`}
          title={getPriorityLabel(task.priority)}
        />

        {onToggleAgenda ? (
          <button
            type="button"
            className={`task-card__agenda ${inAgenda ? 'task-card__agenda--active' : ''}`}
            onClick={onToggleAgenda}
            aria-pressed={inAgenda}
            aria-label={
              inAgenda
                ? 'Quitar del orden del día'
                : 'Agregar al orden del día'
            }
            title={
              inAgenda
                ? 'Quitar del orden del día'
                : 'Agregar al orden del día'
            }
          >
            <svg
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
          </button>
        ) : null}

        <span className="task-card__toolbar-spacer" />

        <button
          type="button"
          className="task-card__delete"
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          ×
        </button>
      </div>
    </div>
  )
}
