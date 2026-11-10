import { Fragment, useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { formatAgendaBudget, getAgendaSortableId } from '../agenda'
import { getTimeOfDayLabel } from '../taskTimeOfDay'
import type { Project, TaskEffort, TaskPriority, TaskTimeOfDay } from '../types'
import { AddTaskDialog, type NewAgendaTask } from './AddTaskDialog'
import type { AgendaItem } from './AgendaColumn'
import { TaskCard } from './TaskCard'

type FocusViewProps = {
  items: AgendaItem[]
  projects: Project[]
  onUpdateTask: (projectId: string, taskId: string, title: string) => void
  onSetTaskPriority: (projectId: string, taskId: string, priority: TaskPriority | null) => void
  onSetTaskEffort: (projectId: string, taskId: string, effort: TaskEffort | null) => void
  onSetTaskTimeOfDay: (projectId: string, taskId: string, timeOfDay: TaskTimeOfDay | null) => void
  onToggleTaskComplete: (projectId: string, taskId: string) => void
  onRemoveTask: (taskId: string) => void
  onSort: () => void
  onClear: () => void
  onCreateTask: (task: NewAgendaTask) => void
  initialProjectId: string | null
  onRememberProject: (projectId: string) => void
}

function formatFocusDate(date: Date): string {
  const formatted = date.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function FocusView({
  items,
  projects,
  onUpdateTask,
  onSetTaskPriority,
  onSetTaskEffort,
  onSetTaskTimeOfDay,
  onToggleTaskComplete,
  onRemoveTask,
  onSort,
  onClear,
  onCreateTask,
  initialProjectId,
  onRememberProject,
}: FocusViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const budget = formatAgendaBudget(items.map((item) => item.task.effort))
  const countLabel = items.length === 1 ? '1 tarea' : `${items.length} tareas`
  const meta = [formatFocusDate(new Date()), countLabel, budget].filter(Boolean).join(' · ')
  const sortableIds = items.map((item) => getAgendaSortableId(item.task.id))

  return (
    <div className="focus">
      <header className="focus__header">
        <div>
          <h2 className="focus__title">Enfoque</h2>
          <p className="focus__meta">{meta}</p>
        </div>
        <button className="button" type="button" onClick={() => setDialogOpen(true)}>
          Agregar tarea
        </button>
      </header>

      {items.length === 0 ? (
        <p className="focus__empty">No hay tareas en el orden del día.</p>
      ) : (
        <div className="focus__list">
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => {
              const previous = items[index - 1]
              const timeOfDay = item.task.timeOfDay
              const showDivider = previous !== undefined && previous.task.timeOfDay !== timeOfDay
              return (
                <Fragment key={item.task.id}>
                  {showDivider ? (
                    <div
                      className={`focus__divider focus__divider--${timeOfDay ?? 'none'}`}
                      role="separator"
                    >
                      {getTimeOfDayLabel(timeOfDay)}
                    </div>
                  ) : null}
                  <TaskCard
                    task={item.task}
                    sortableId={getAgendaSortableId(item.task.id)}
                    dragType="agenda-task"
                    projectName={item.projectName}
                    allowDragWhenCompleted
                    deleteLabel="Quitar del orden del día"
                    onUpdate={(title) => onUpdateTask(item.projectId, item.task.id, title)}
                    onSetPriority={(priority) => onSetTaskPriority(item.projectId, item.task.id, priority)}
                    onSetEffort={(effort) => onSetTaskEffort(item.projectId, item.task.id, effort)}
                    onSetTimeOfDay={(timeOfDay) => onSetTaskTimeOfDay(item.projectId, item.task.id, timeOfDay)}
                    onToggleComplete={() => onToggleTaskComplete(item.projectId, item.task.id)}
                    onDelete={() => onRemoveTask(item.task.id)}
                  />
                </Fragment>
              )
            })}
          </SortableContext>
        </div>
      )}

      {items.length > 0 ? (
        <footer className="focus__footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={onSort}
            disabled={items.length < 2}
            title="Momento del día, luego prioridad y duración de menor a mayor"
          >
            Ordenar
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              const confirmed = window.confirm(
                '¿Quitar todas las tareas del orden del día? Seguirán en sus proyectos.',
              )
              if (confirmed) onClear()
            }}
            aria-label="Quitar todas las tareas del orden del día"
          >
            Quitar todas
          </button>
        </footer>
      ) : null}

      {dialogOpen ? (
        <AddTaskDialog
          projects={projects}
          initialProjectId={initialProjectId}
          onClose={() => setDialogOpen(false)}
          onSubmit={(task) => {
            onCreateTask(task)
            onRememberProject(task.projectId)
            setDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
