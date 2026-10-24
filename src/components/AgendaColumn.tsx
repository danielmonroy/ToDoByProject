import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  AGENDA_DROPPABLE_ID,
  getAgendaSortableId,
} from '../agenda'
import type { Task, TaskEffort, TaskPriority, TaskTimeOfDay } from '../types'
import { formatBudgetedMinutes, getEffortMinutes } from '../taskEffort'
import { TaskCard } from './TaskCard'

export type AgendaItem = {
  projectId: string
  projectName: string
  task: Task
}

type AgendaColumnProps = {
  items: AgendaItem[]
  onClose: () => void
  onUpdateTask: (projectId: string, taskId: string, title: string) => void
  onSetTaskPriority: (
    projectId: string,
    taskId: string,
    priority: TaskPriority | null,
  ) => void
  onSetTaskEffort: (
    projectId: string,
    taskId: string,
    effort: TaskEffort | null,
  ) => void
  onSetTaskTimeOfDay: (
    projectId: string,
    taskId: string,
    timeOfDay: TaskTimeOfDay | null,
  ) => void
  onToggleTaskComplete: (projectId: string, taskId: string) => void
  onRemoveTask: (taskId: string) => void
  onSort: () => void
  onClear: () => void
}

function formatAgendaDate(date: Date): string {
  return date.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatAgendaBudget(items: AgendaItem[]): string | null {
  if (items.length === 0) return null

  const estimated = items.filter((item) => item.task.effort)
  if (estimated.length === 0) return 'Sin tiempo presupuestado'

  const totalMinutes = estimated.reduce((total, item) => {
    const effort = item.task.effort
    return effort ? total + getEffortMinutes(effort) : total
  }, 0)
  const budget = formatBudgetedMinutes(totalMinutes)
  const missing = items.length - estimated.length
  if (missing === 0) return budget
  const missingLabel = missing === 1 ? '1 sin tiempo' : `${missing} sin tiempo`
  return `${budget} · ${missingLabel}`
}

export function AgendaColumn({
  items,
  onClose,
  onUpdateTask,
  onSetTaskPriority,
  onSetTaskEffort,
  onSetTaskTimeOfDay,
  onToggleTaskComplete,
  onRemoveTask,
  onSort,
  onClear,
}: AgendaColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: AGENDA_DROPPABLE_ID,
  })

  const sortableIds = items.map((item) => getAgendaSortableId(item.task.id))
  const budget = formatAgendaBudget(items)

  return (
    <section
      ref={setNodeRef}
      className={`project-column agenda-column ${isOver ? 'project-column--over' : ''}`}
    >
      <header className="project-column__header">
        <div className="project-column__heading">
          <div className="agenda-column__titles">
            <span className="project-column__name agenda-column__title">
              Orden del día
            </span>
            <span className="agenda-column__date">{formatAgendaDate(new Date())}</span>
            {budget ? (
              <span className="agenda-column__budget">{budget}</span>
            ) : null}
          </div>
          <span
            className="project-column__count"
            aria-label={`${items.length} ${
              items.length === 1 ? 'tarea pendiente' : 'tareas pendientes'
            }`}
          >
            {items.length}
          </span>
        </div>

        <button
          type="button"
          className="project-column__delete"
          aria-label="Cerrar orden del día"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="project-column__tasks">
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <TaskCard
              key={item.task.id}
              task={item.task}
              sortableId={getAgendaSortableId(item.task.id)}
              dragType="agenda-task"
              projectName={item.projectName}
              allowDragWhenCompleted
              deleteLabel="Quitar del orden del día"
              onUpdate={(title) =>
                onUpdateTask(item.projectId, item.task.id, title)
              }
              onSetPriority={(priority) =>
                onSetTaskPriority(item.projectId, item.task.id, priority)
              }
              onSetEffort={(effort) =>
                onSetTaskEffort(item.projectId, item.task.id, effort)
              }
              onSetTimeOfDay={(timeOfDay) =>
                onSetTaskTimeOfDay(item.projectId, item.task.id, timeOfDay)
              }
              onToggleComplete={() =>
                onToggleTaskComplete(item.projectId, item.task.id)
              }
              onDelete={() => onRemoveTask(item.task.id)}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <p className="project-column__empty">
            Arrastra aquí tareas de tus proyectos para armar el día.
          </p>
        )}
      </div>

      <footer className="agenda-column__footer">
        <p className="agenda-column__hint">
          Solo se pueden agregar tareas que ya existen en un proyecto.
        </p>
        <button
          type="button"
          className="agenda-column__sort"
          onClick={onSort}
          disabled={items.length < 2}
          aria-label="Ordenar por momento del día, prioridad y duración"
          title="Momento del día, luego prioridad y duración de menor a mayor"
        >
          Ordenar
        </button>
        <button
          type="button"
          className="agenda-column__clear"
          onClick={onClear}
          disabled={items.length === 0}
          aria-label="Quitar todas las tareas del orden del día"
        >
          Quitar todas
        </button>
      </footer>
    </section>
  )
}
