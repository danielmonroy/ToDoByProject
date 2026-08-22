import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Project } from '../types'
import { TaskCard } from './TaskCard'

export function getColumnSortableId(projectId: string): string {
  return `column:${projectId}`
}

type ProjectColumnProps = {
  project: Project
  showCompleted: boolean
  onRename: (name: string) => void
  onDelete: () => void
  onAddTask: (title: string) => void
  onUpdateTask: (taskId: string, title: string) => void
  onToggleTaskComplete: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
}

export function ProjectColumn({
  project,
  showCompleted,
  onRename,
  onDelete,
  onAddTask,
  onUpdateTask,
  onToggleTaskComplete,
  onDeleteTask,
}: ProjectColumnProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(project.name)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const pendingTasks = project.tasks.filter((task) => !task.completed)
  const completedTasks = project.tasks.filter((task) => task.completed)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getColumnSortableId(project.id),
    data: { type: 'column', projectId: project.id },
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: project.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditingName])

  useEffect(() => {
    if (!isEditingName) setNameDraft(project.name)
  }, [project.name, isEditingName])

  const saveName = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setNameDraft(project.name)
      setIsEditingName(false)
      return
    }
    onRename(trimmed)
    setIsEditingName(false)
  }

  const cancelNameEdit = () => {
    setNameDraft(project.name)
    setIsEditingName(false)
  }

  const handleAddTask = () => {
    const trimmed = newTaskTitle.trim()
    if (!trimmed) return
    onAddTask(trimmed)
    setNewTaskTitle('')
  }

  const handleDeleteProject = () => {
    const confirmed = window.confirm(
      `¿Eliminar el proyecto "${project.name}" y todas sus tareas?`,
    )
    if (confirmed) onDelete()
  }

  return (
    <section
      ref={setSortableRef}
      style={style}
      className={`project-column ${isOver ? 'project-column--over' : ''} ${isDragging ? 'project-column--dragging' : ''}`}
    >
      <header className="project-column__header">
        <button
          type="button"
          className="project-column__drag-handle"
          aria-label="Arrastrar proyecto"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>

        {isEditingName ? (
          <input
            ref={nameInputRef}
            className="project-column__name-input"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveName()
              if (event.key === 'Escape') cancelNameEdit()
            }}
          />
        ) : (
          <button
            type="button"
            className="project-column__name"
            onClick={() => setIsEditingName(true)}
          >
            {project.name}
          </button>
        )}

        <button
          type="button"
          className="project-column__delete"
          aria-label="Eliminar proyecto"
          onClick={handleDeleteProject}
        >
          ×
        </button>
      </header>

      <div ref={setDroppableRef} className="project-column__tasks">
        <SortableContext
          items={pendingTasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={(title) => onUpdateTask(task.id, title)}
              onToggleComplete={() => onToggleTaskComplete(task.id)}
              onDelete={() => onDeleteTask(task.id)}
            />
          ))}
        </SortableContext>

        {pendingTasks.length === 0 && (
          <p className="project-column__empty">Sin tareas pendientes</p>
        )}

        {showCompleted && completedTasks.length > 0 && (
          <div className="project-column__completed">
            <p className="project-column__completed-label">Completadas</p>
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                draggable={false}
                onUpdate={(title) => onUpdateTask(task.id, title)}
                onToggleComplete={() => onToggleTaskComplete(task.id)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="project-column__footer">
        <input
          className="project-column__add-input"
          type="text"
          placeholder="Agregar tarea"
          value={newTaskTitle}
          onChange={(event) => setNewTaskTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleAddTask()
          }}
        />
        <button
          type="button"
          className="project-column__add-button"
          onClick={handleAddTask}
        >
          Agregar
        </button>
      </footer>
    </section>
  )
}
