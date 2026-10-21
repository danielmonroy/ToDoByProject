import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskEffort, TaskPriority, TaskTimeOfDay } from '../types'
import { getEffortLabel, getEffortLevel, getEffortShortLabel, getNextEffort } from '../taskEffort'
import { getNextPriority, getPriorityLabel } from '../taskPriority'
import { getNextTimeOfDay, getTimeOfDayLabel } from '../taskTimeOfDay'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function TimeOfDayIcon({ timeOfDay }: { timeOfDay: TaskTimeOfDay | null }) {
  if (timeOfDay === 'early_morning') {
    return (
      <svg {...iconProps}>
        <path d="M12 10V7" />
        <path d="m8.2 11.2-1.6-1.6" />
        <path d="m15.8 11.2 1.6-1.6" />
        <path d="M4 18h16" />
        <path d="M7 18a5 5 0 0 1 10 0" />
      </svg>
    )
  }

  if (timeOfDay === 'morning') {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3.25" />
        <path d="M12 3.5v2.2" />
        <path d="M12 18.3v2.2" />
        <path d="M3.5 12h2.2" />
        <path d="M18.3 12h2.2" />
        <path d="m6 6 1.6 1.6" />
        <path d="m16.4 16.4 1.6 1.6" />
        <path d="m18 6-1.6 1.6" />
        <path d="m7.6 16.4-1.6 1.6" />
      </svg>
    )
  }

  if (timeOfDay === 'afternoon') {
    return (
      <svg {...iconProps}>
        <path d="M12 3v2" />
        <path d="m4.9 4.9 1.4 1.4" />
        <path d="M20 12h2" />
        <path d="m19.1 4.9-1.4 1.4" />
        <path d="M15.9 12.7a4 4 0 0 0-5.9-4.1" />
        <path d="M13 21H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z" />
      </svg>
    )
  }

  if (timeOfDay === 'night') {
    return (
      <svg {...iconProps}>
        <path d="M21 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 21 16.8" />
      </svg>
    )
  }

  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5v1.5" />
      <path d="M12 17.5V19" />
      <path d="M5 12h1.5" />
      <path d="M17.5 12H19" />
    </svg>
  )
}

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
  onSetEffort: (effort: TaskEffort | null) => void
  onSetTimeOfDay: (timeOfDay: TaskTimeOfDay | null) => void
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
  onSetEffort,
  onSetTimeOfDay,
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

  const handleEffortClick = () => {
    onSetEffort(getNextEffort(task.effort))
  }

  const handleTimeOfDayClick = () => {
    onSetTimeOfDay(getNextTimeOfDay(task.timeOfDay))
  }

  const canDrag = draggable && (!task.completed || allowDragWhenCompleted)
  const effort = task.effort
  const timeOfDay = task.timeOfDay

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

        <button
          type="button"
          className={`task-card__effort ${effort ? `task-card__effort--${effort}` : 'task-card__effort--none'}`}
          onClick={handleEffortClick}
          aria-label={`${getEffortLabel(effort)}. Clic para cambiar.`}
          title={getEffortLabel(effort)}
        >
          {effort ? (
            <>
              <span className="task-card__effort-meter" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    className={index < getEffortLevel(effort) ? 'is-filled' : undefined}
                  />
                ))}
              </span>
              {getEffortShortLabel(effort)}
            </>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={`task-card__time ${timeOfDay ? `task-card__time--${timeOfDay}` : 'task-card__time--none'}`}
          onClick={handleTimeOfDayClick}
          aria-label={`${getTimeOfDayLabel(timeOfDay)}. Clic para cambiar.`}
          title={getTimeOfDayLabel(timeOfDay)}
        >
          <TimeOfDayIcon timeOfDay={timeOfDay} />
        </button>

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
