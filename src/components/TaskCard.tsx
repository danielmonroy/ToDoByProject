import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskPriority } from '../types'
import { getNextPriority, getPriorityLabel } from '../taskPriority'

type TaskCardProps = {
  task: Task
  draggable?: boolean
  onUpdate: (title: string) => void
  onSetPriority: (priority: TaskPriority | null) => void
  onToggleComplete: () => void
  onDelete: () => void
}

export function TaskCard({
  task,
  draggable = true,
  onUpdate,
  onSetPriority,
  onToggleComplete,
  onDelete,
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
    id: task.id,
    data: { type: 'task' },
    disabled: !draggable || task.completed,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? 'task-card--dragging' : ''} ${task.completed ? 'task-card--completed' : ''}`}
    >
      <div className="task-card__body">
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
        {draggable && !task.completed ? (
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

        <span className="task-card__toolbar-spacer" />

        <button
          type="button"
          className="task-card__delete"
          aria-label="Eliminar tarea"
          onClick={onDelete}
        >
          ×
        </button>
      </div>
    </div>
  )
}
