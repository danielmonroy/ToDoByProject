import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'

type TaskCardProps = {
  task: Task
  draggable?: boolean
  onUpdate: (title: string) => void
  onToggleComplete: () => void
  onDelete: () => void
}

export function TaskCard({
  task,
  draggable = true,
  onUpdate,
  onToggleComplete,
  onDelete,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? 'task-card--dragging' : ''} ${task.completed ? 'task-card--completed' : ''}`}
    >
      <input
        type="checkbox"
        className="task-card__checkbox"
        checked={task.completed}
        onChange={onToggleComplete}
        aria-label={
          task.completed ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada'
        }
      />

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

      {isEditing ? (
        <input
          ref={inputRef}
          className="task-card__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
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

      <button
        type="button"
        className="task-card__delete"
        aria-label="Eliminar tarea"
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  )
}
