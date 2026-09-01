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
import {
  AGENDA_DROPPABLE_ID,
  countPendingTasks,
  isAgendaTarget,
  parseAgendaSortableId,
} from '../agenda'
import { AgendaColumn, type AgendaItem } from './AgendaColumn'
import { getColumnSortableId, ProjectColumn } from './ProjectColumn'

type BoardProps = {
  board: BoardState
  showCompleted: boolean
  showAgenda: boolean
  onChange: (board: BoardState) => void
  onShowAgenda: () => void
  onHideAgenda: () => void
}

type DragType = 'column' | 'task' | 'agenda-task'

type DeletedTaskUndo = {
  projectId: string
  task: Task
  index: number
  agendaIndex: number | null
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

function getAgendaTaskIds(board: BoardState): string[] {
  return board.agendaTaskIds ?? []
}

function getAgendaItems(board: BoardState): AgendaItem[] {
  return getAgendaTaskIds(board).flatMap((taskId) => {
    const project = findProjectByTaskId(board, taskId)
    const task = project?.tasks.find((item) => item.id === taskId)
    if (!project || !task || task.completed) return []
    return [{ projectId: project.id, projectName: project.name, task }]
  })
}

function addTaskToAgenda(
  board: BoardState,
  taskId: string,
  overTaskId?: string,
): BoardState {
  const project = findProjectByTaskId(board, taskId)
  const task = project?.tasks.find((item) => item.id === taskId)
  if (!project || !task || task.completed) return board

  const ids = getAgendaTaskIds(board).filter((id) => id !== taskId)
  let insertIndex = ids.length

  if (overTaskId && overTaskId !== taskId) {
    const overIndex = ids.findIndex((id) => id === overTaskId)
    if (overIndex !== -1) insertIndex = overIndex
  }

  ids.splice(insertIndex, 0, taskId)
  return { ...board, agendaTaskIds: ids }
}

function removeTaskFromAgenda(board: BoardState, taskId: string): BoardState {
  if (!getAgendaTaskIds(board).includes(taskId)) return board
  return {
    ...board,
    agendaTaskIds: getAgendaTaskIds(board).filter((id) => id !== taskId),
  }
}

function pruneAgendaTaskIds(
  board: BoardState,
  predicate: (taskId: string) => boolean,
): BoardState {
  const currentIds = getAgendaTaskIds(board)
  const agendaTaskIds = currentIds.filter(predicate)
  if (agendaTaskIds.length === currentIds.length) return board
  return { ...board, agendaTaskIds }
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

  if (dragType === 'task' || dragType === 'agenda-task') {
    const pointerCollisions = pointerWithin(args)
    const agendaItemCollisions = pointerCollisions.filter((collision) =>
      String(collision.id).startsWith('agenda:'),
    )
    if (agendaItemCollisions.length > 0) return agendaItemCollisions

    const agendaCollisions = pointerCollisions.filter(
      (collision) => String(collision.id) === AGENDA_DROPPABLE_ID,
    )
    if (agendaCollisions.length > 0) return agendaCollisions

    return closestCorners(args).filter(
      (collision) => !isAgendaTarget(String(collision.id)),
    )
  }

  return closestCorners(args)
}

export function Board({
  board,
  showCompleted,
  showAgenda,
  onChange,
  onShowAgenda,
  onHideAgenda,
}: BoardProps) {
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

      let agendaTaskIds = getAgendaTaskIds(current)
      if (
        entry.agendaIndex !== null &&
        !agendaTaskIds.includes(entry.task.id)
      ) {
        agendaTaskIds = [...agendaTaskIds]
        agendaTaskIds.splice(
          Math.min(entry.agendaIndex, agendaTaskIds.length),
          0,
          entry.task.id,
        )
      }

      return {
        ...current,
        agendaTaskIds,
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

    const taskId =
      dragType === 'agenda-task'
        ? parseAgendaSortableId(String(event.active.id))
        : String(event.active.id)
    const task = taskId ? getTask(board, taskId) : undefined
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

    if (dragType === 'agenda-task') {
      const activeTaskId = parseAgendaSortableId(activeId)
      const overTaskId = parseAgendaSortableId(overId)
      if (!activeTaskId || !overTaskId || activeTaskId === overTaskId) return

      updateBoard((current) => {
        const agendaTaskIds = getAgendaTaskIds(current)
        const oldIndex = agendaTaskIds.indexOf(activeTaskId)
        const newIndex = agendaTaskIds.indexOf(overTaskId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return current
        }

        return {
          ...current,
          agendaTaskIds: arrayMove(agendaTaskIds, oldIndex, newIndex),
        }
      })
      return
    }
    if (isAgendaTarget(overId)) return

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

    if (dragType === 'agenda-task') {
      return
    }

    if (isAgendaTarget(overId)) {
      const overTaskId = parseAgendaSortableId(overId) ?? undefined
      updateBoard((current) => addTaskToAgenda(current, activeId, overTaskId))
      onShowAgenda()
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
    updateBoard((current) => {
      const project = current.projects.find((item) => item.id === projectId)
      const removedTaskIds = new Set(project?.tasks.map((task) => task.id) ?? [])
      return pruneAgendaTaskIds(
        {
          ...current,
          projects: current.projects.filter((item) => item.id !== projectId),
        },
        (taskId) => !removedTaskIds.has(taskId),
      )
    })
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
    updateBoard((current) => {
      const project = current.projects.find((item) => item.id === projectId)
      const task = project?.tasks.find((item) => item.id === taskId)
      const willComplete = !task?.completed

      const next: BoardState = {
        ...current,
        projects: current.projects.map((item) =>
          item.id === projectId
            ? {
                ...item,
                tasks: item.tasks.map((entry) =>
                  entry.id === taskId
                    ? { ...entry, completed: !entry.completed }
                    : entry,
                ),
              }
            : item,
        ),
      }

      return willComplete ? removeTaskFromAgenda(next, taskId) : next
    })
  }

  const handleDeleteTask = (projectId: string, taskId: string) => {
    const current = boardRef.current
    const project = current.projects.find((item) => item.id === projectId)
    const index = project?.tasks.findIndex((task) => task.id === taskId) ?? -1
    const task = index === -1 ? undefined : project?.tasks[index]
    const agendaIndex = getAgendaTaskIds(current).indexOf(taskId)

    if (project && task && index !== -1) {
      undoStackRef.current.push({
        projectId,
        task,
        index,
        agendaIndex: agendaIndex === -1 ? null : agendaIndex,
      })
      if (undoStackRef.current.length > MAX_UNDO_STACK) {
        undoStackRef.current.shift()
      }
    }

    updateBoard((board) =>
      pruneAgendaTaskIds(
        {
          ...board,
          projects: board.projects.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  tasks: item.tasks.filter((entry) => entry.id !== taskId),
                }
              : item,
          ),
        },
        (id) => id !== taskId,
      ),
    )
  }

  const handleToggleAgenda = (taskId: string) => {
    const isAdding = !getAgendaTaskIds(boardRef.current).includes(taskId)
    updateBoard((current) => {
      if (getAgendaTaskIds(current).includes(taskId)) {
        return removeTaskFromAgenda(current, taskId)
      }
      return addTaskToAgenda(current, taskId)
    })
    if (isAdding) onShowAgenda()
  }

  const handleRemoveFromAgenda = (taskId: string) => {
    updateBoard((current) => removeTaskFromAgenda(current, taskId))
  }

  const handleClearAgenda = () => {
    updateBoard((current) => {
      if (getAgendaTaskIds(current).length === 0) return current
      return { ...current, agendaTaskIds: [] }
    })
  }

  const columnIds = board.projects.map((project) =>
    getColumnSortableId(project.id),
  )
  const agendaItems = getAgendaItems(board)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        {showAgenda ? (
          <AgendaColumn
            items={agendaItems}
            onClose={onHideAgenda}
            onUpdateTask={handleUpdateTask}
            onSetTaskPriority={handleSetTaskPriority}
            onToggleTaskComplete={handleToggleTaskComplete}
            onRemoveTask={handleRemoveFromAgenda}
            onClear={handleClearAgenda}
          />
        ) : null}

        <SortableContext
          items={columnIds}
          strategy={horizontalListSortingStrategy}
        >
          {board.projects.map((project) => (
            <ProjectColumn
              key={project.id}
              project={project}
              showCompleted={showCompleted}
              agendaTaskIds={getAgendaTaskIds(board)}
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
              onToggleAgenda={(taskId) => handleToggleAgenda(taskId)}
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
                  {countPendingTasks(activeProject.tasks)}
                </span>
              </div>
            </header>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
