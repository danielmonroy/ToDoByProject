import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { BoardState, Project, Task, TaskPriority } from '../types'
import { getColumnSortableId, ProjectColumn } from './ProjectColumn'

type BoardProps = {
  board: BoardState
  showCompleted: boolean
  onChange: (board: BoardState) => void
}

type DragType = 'column' | 'task'

type DeletedTaskUndo = {
  projectId: string
  task: Task
  index: number
}

const MAX_UNDO_STACK = 20

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    target.isContentEditable
  )
}

function parseColumnSortableId(id: string): string | null {
  return id.startsWith('column:') ? id.slice('column:'.length) : null
}

function findProjectByTaskId(
  board: BoardState,
  taskId: string,
): Project | undefined {
  return board.projects.find((project) =>
    project.tasks.some((task) => task.id === taskId),
  )
}

function findProjectById(
  board: BoardState,
  projectId: string,
): Project | undefined {
  return board.projects.find((project) => project.id === projectId)
}

function getTask(board: BoardState, taskId: string): Task | undefined {
  const project = findProjectByTaskId(board, taskId)
  return project?.tasks.find((task) => task.id === taskId)
}

function resolveOverProjectId(
  board: BoardState,
  overId: string,
): string | undefined {
  const columnProjectId = parseColumnSortableId(overId)
  if (columnProjectId) return columnProjectId

  const project = findProjectById(board, overId)
  if (project) return project.id

  const projectWithTask = findProjectByTaskId(board, overId)
  return projectWithTask?.id
}

function reorderProjects(
  board: BoardState,
  activeProjectId: string,
  overProjectId: string,
): BoardState {
  const oldIndex = board.projects.findIndex(
    (project) => project.id === activeProjectId,
  )
  const newIndex = board.projects.findIndex(
    (project) => project.id === overProjectId,
  )

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return board
  }

  return {
    ...board,
    projects: arrayMove(board.projects, oldIndex, newIndex),
  }
}

function moveTask(
  board: BoardState,
  taskId: string,
  fromProjectId: string,
  toProjectId: string,
  overTaskId?: string,
): BoardState {
  const sourceProject = findProjectById(board, fromProjectId)
  const destinationProject = findProjectById(board, toProjectId)
  if (!sourceProject || !destinationProject) return board

  const taskIndex = sourceProject.tasks.findIndex((task) => task.id === taskId)
  if (taskIndex === -1) return board

  const task = sourceProject.tasks[taskIndex]

  const projects = board.projects.map((project) => {
    if (project.id === fromProjectId) {
      return {
        ...project,
        tasks: project.tasks.filter((item) => item.id !== taskId),
      }
    }
    return project
  })

  return {
    ...board,
    projects: projects.map((project) => {
      if (project.id !== toProjectId) return project

      const tasks = [...project.tasks]
      let insertIndex = tasks.length

      if (overTaskId && overTaskId !== taskId) {
        const overIndex = tasks.findIndex((item) => item.id === overTaskId)
        if (overIndex !== -1) insertIndex = overIndex
      }

      tasks.splice(insertIndex, 0, task)
      return { ...project, tasks }
    }),
  }
}

const collisionDetection: CollisionDetection = (args) => {
  const dragType = args.active.data.current?.type as DragType | undefined

  if (dragType === 'column') {
    const columnCollisions = pointerWithin(args).filter((collision) =>
      String(collision.id).startsWith('column:'),
    )

    if (columnCollisions.length > 0) return columnCollisions
  }

  return closestCorners(args)
}

export function Board({ board, showCompleted, onChange }: BoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const boardRef = useRef(board)
  const activeDragTypeRef = useRef<DragType | null>(null)
  const undoStackRef = useRef<DeletedTaskUndo[]>([])

  useEffect(() => {
    boardRef.current = board
  }, [board])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const updateBoard = useCallback(
    (updater: (current: BoardState) => BoardState) => {
      const next = updater(boardRef.current)
      boardRef.current = next
      onChange(next)
    },
    [onChange],
  )

  const undoLastDelete = useCallback(() => {
    const entry = undoStackRef.current.pop()
    if (!entry) return

    updateBoard((current) => {
      const project = current.projects.find(
        (item) => item.id === entry.projectId,
      )
      if (!project) return current
      if (project.tasks.some((task) => task.id === entry.task.id)) return current

      const tasks = [...project.tasks]
      const insertAt = Math.min(entry.index, tasks.length)
      tasks.splice(insertAt, 0, entry.task)

      return {
        ...current,
        projects: current.projects.map((item) =>
          item.id === entry.projectId ? { ...item, tasks } : item,
        ),
      }
    })
  }, [updateBoard])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z') return
      if (!event.ctrlKey && !event.metaKey) return
      if (event.shiftKey) return
      if (isEditableTarget(event.target)) return

      if (undoStackRef.current.length === 0) return

      event.preventDefault()
      undoLastDelete()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undoLastDelete])

  const handleDragStart = (event: DragStartEvent) => {
    const dragType = event.active.data.current?.type as DragType | undefined
    activeDragTypeRef.current = dragType ?? null

    if (dragType === 'column') {
      const projectId = parseColumnSortableId(String(event.active.id))
      setActiveProject(
        projectId ? findProjectById(board, projectId) ?? null : null,
      )
      setActiveTask(null)
      return
    }

    const task = getTask(board, String(event.active.id))
    setActiveTask(task ?? null)
    setActiveProject(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const dragType = activeDragTypeRef.current
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (dragType === 'column') {
      const activeProjectId = parseColumnSortableId(activeId)
      const overProjectId = resolveOverProjectId(boardRef.current, overId)

      if (!activeProjectId || !overProjectId) return
      if (activeProjectId === overProjectId) return

      updateBoard((current) =>
        reorderProjects(current, activeProjectId, overProjectId),
      )
      return
    }

    const sourceProject = findProjectByTaskId(boardRef.current, activeId)
    const overProjectId = resolveOverProjectId(boardRef.current, overId)

    if (!sourceProject || !overProjectId) return
    if (sourceProject.id === overProjectId) return

    updateBoard((current) =>
      moveTask(current, activeId, sourceProject.id, overProjectId, overId),
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const dragType = activeDragTypeRef.current
    activeDragTypeRef.current = null

    setActiveTask(null)
    setActiveProject(null)

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (dragType === 'column') {
      const activeProjectId = parseColumnSortableId(activeId)
      const overProjectId = resolveOverProjectId(boardRef.current, overId)

      if (!activeProjectId || !overProjectId) return
      if (activeProjectId === overProjectId) return

      updateBoard((current) =>
        reorderProjects(current, activeProjectId, overProjectId),
      )
      return
    }

    const sourceProject = findProjectByTaskId(boardRef.current, activeId)
    const overProjectId = resolveOverProjectId(boardRef.current, overId)

    if (!sourceProject || !overProjectId) return

    if (sourceProject.id === overProjectId) {
      const activeIndex = sourceProject.tasks.findIndex(
        (task) => task.id === activeId,
      )
      const overIndex = sourceProject.tasks.findIndex(
        (task) => task.id === overId,
      )

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return
      }

      updateBoard((current) => ({
        ...current,
        projects: current.projects.map((project) => {
          if (project.id !== sourceProject.id) return project
          return {
            ...project,
            tasks: arrayMove(project.tasks, activeIndex, overIndex),
          }
        }),
      }))
    }
  }

  const handleAddProject = () => {
    updateBoard((current) => ({
      ...current,
      projects: [
        ...current.projects,
        {
          id: crypto.randomUUID(),
          name: 'Nuevo proyecto',
          tasks: [],
        },
      ],
    }))
  }

  const handleRenameProject = (projectId: string, name: string) => {
    updateBoard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId ? { ...project, name } : project,
      ),
    }))
  }

  const handleDeleteProject = (projectId: string) => {
    updateBoard((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== projectId),
    }))
  }

  const handleAddTask = (projectId: string, title: string) => {
    updateBoard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              tasks: [
                ...project.tasks,
                { id: crypto.randomUUID(), title, completed: false, priority: null },
              ],
            }
          : project,
      ),
    }))
  }

  const handleUpdateTask = (
    projectId: string,
    taskId: string,
    title: string,
  ) => {
    updateBoard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task.id === taskId ? { ...task, title } : task,
              ),
            }
          : project,
      ),
    }))
  }

  const handleSetTaskPriority = (
    projectId: string,
    taskId: string,
    priority: TaskPriority | null,
  ) => {
    updateBoard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task.id === taskId ? { ...task, priority } : task,
              ),
            }
          : project,
      ),
    }))
  }

  const handleToggleTaskComplete = (projectId: string, taskId: string) => {
    updateBoard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task.id === taskId
                  ? { ...task, completed: !task.completed }
                  : task,
              ),
            }
          : project,
      ),
    }))
  }

  const handleDeleteTask = (projectId: string, taskId: string) => {
    const current = boardRef.current
    const project = current.projects.find((item) => item.id === projectId)
    const index = project?.tasks.findIndex((task) => task.id === taskId) ?? -1
    const task = index === -1 ? undefined : project?.tasks[index]

    if (project && task && index !== -1) {
      undoStackRef.current.push({ projectId, task, index })
      if (undoStackRef.current.length > MAX_UNDO_STACK) {
        undoStackRef.current.shift()
      }
    }

    updateBoard((board) => ({
      ...board,
      projects: board.projects.map((item) =>
        item.id === projectId
          ? {
              ...item,
              tasks: item.tasks.filter((entry) => entry.id !== taskId),
            }
          : item,
      ),
    }))
  }

  const columnIds = board.projects.map((project) =>
    getColumnSortableId(project.id),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        <SortableContext
          items={columnIds}
          strategy={horizontalListSortingStrategy}
        >
          {board.projects.map((project) => (
            <ProjectColumn
              key={project.id}
              project={project}
              showCompleted={showCompleted}
              onRename={(name) => handleRenameProject(project.id, name)}
              onDelete={() => handleDeleteProject(project.id)}
              onAddTask={(title) => handleAddTask(project.id, title)}
              onUpdateTask={(taskId, title) =>
                handleUpdateTask(project.id, taskId, title)
              }
              onSetTaskPriority={(taskId, priority) =>
                handleSetTaskPriority(project.id, taskId, priority)
              }
              onToggleTaskComplete={(taskId) =>
                handleToggleTaskComplete(project.id, taskId)
              }
              onDeleteTask={(taskId) => handleDeleteTask(project.id, taskId)}
            />
          ))}
        </SortableContext>

        <button
          type="button"
          className="board__add-project"
          onClick={handleAddProject}
        >
          + Nuevo proyecto
        </button>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="task-card task-card--overlay">{activeTask.title}</div>
        ) : null}
        {activeProject ? (
          <div className="project-column project-column--overlay">
            <header className="project-column__header">
              <div className="project-column__heading">
                <span className="project-column__name">{activeProject.name}</span>
                <span className="project-column__count">
                  {activeProject.tasks.length}
                </span>
              </div>
            </header>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
