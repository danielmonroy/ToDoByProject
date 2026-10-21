import type { BoardState, Project, Task, TaskEffort, TaskPriority, TaskTimeOfDay } from '../src/types.ts'

const PRIORITIES: readonly TaskPriority[] = ['p1', 'p2', 'p3']
const EFFORTS: readonly TaskEffort[] = ['m5', 'm30', 'h2', 'h4', 'h8']
const TIMES: readonly TaskTimeOfDay[] = ['early_morning', 'morning', 'afternoon', 'night']

const MAX_PROJECTS = 1000
const MAX_TASKS = 20000
const MAX_TEXT = 20000
const MAX_ID = 200

type PersistedBoard = {
  version: 1
  projects: BoardState['projects']
  agendaTaskIds?: string[]
}

function isPriority(value: unknown): value is TaskPriority | null | undefined {
  return value === undefined || value === null || (typeof value === 'string' && PRIORITIES.includes(value as TaskPriority))
}

function isEffort(value: unknown): value is TaskEffort | null | undefined {
  return value === undefined || value === null || (typeof value === 'string' && EFFORTS.includes(value as TaskEffort))
}

function isTimeOfDay(value: unknown): value is TaskTimeOfDay | null | undefined {
  return value === undefined || value === null || (typeof value === 'string' && TIMES.includes(value as TaskTimeOfDay))
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const task = value as Task
  return (
    typeof task.id === 'string' &&
    task.id.length > 0 &&
    task.id.length <= MAX_ID &&
    typeof task.title === 'string' &&
    task.title.length <= MAX_TEXT &&
    (task.completed === undefined || typeof task.completed === 'boolean') &&
    isPriority(task.priority) &&
    isEffort(task.effort) &&
    isTimeOfDay(task.timeOfDay)
  )
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const project = value as Project
  return (
    typeof project.id === 'string' &&
    project.id.length > 0 &&
    project.id.length <= MAX_ID &&
    typeof project.name === 'string' &&
    project.name.length <= MAX_TEXT &&
    Array.isArray(project.tasks) &&
    project.tasks.every(isTask)
  )
}

function isPersistedBoard(value: unknown): value is PersistedBoard {
  if (!value || typeof value !== 'object') return false
  const board = value as PersistedBoard
  if (board.version !== 1 || !Array.isArray(board.projects)) return false
  if (board.projects.length > MAX_PROJECTS || !board.projects.every(isProject)) return false

  const taskCount = board.projects.reduce((total, project) => total + project.tasks.length, 0)
  if (taskCount > MAX_TASKS) return false

  if (board.agendaTaskIds === undefined) return true
  return (
    Array.isArray(board.agendaTaskIds) &&
    board.agendaTaskIds.length <= MAX_TASKS &&
    board.agendaTaskIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID)
  )
}

function pendingTaskIds(projects: BoardState['projects']): Set<string> {
  const ids = new Set<string>()
  for (const project of projects) {
    for (const task of project.tasks) {
      if (!task.completed) ids.add(task.id)
    }
  }
  return ids
}

function normalizeAgenda(projects: BoardState['projects'], agendaTaskIds: string[] | undefined): string[] {
  if (!agendaTaskIds) return []
  const pending = pendingTaskIds(projects)
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const id of agendaTaskIds) {
    if (!pending.has(id) || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }
  return normalized
}

export function emptyBoard(): BoardState {
  return { version: 1, projects: [], agendaTaskIds: [] }
}

export function parseBoard(value: unknown): BoardState | null {
  if (!isPersistedBoard(value)) return null

  const projects = value.projects.map((project) => ({
    id: project.id,
    name: project.name,
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed ?? false,
      priority: task.priority ?? null,
      effort: task.effort ?? null,
      timeOfDay: task.timeOfDay ?? null,
    })),
  }))

  return {
    version: 1,
    projects,
    agendaTaskIds: normalizeAgenda(projects, value.agendaTaskIds),
  }
}

export function summarizeBoard(board: BoardState): { projects: number; tasks: number } {
  let tasks = 0
  for (const project of board.projects) tasks += project.tasks.length
  return { projects: board.projects.length, tasks }
}

export function boardsEqual(left: BoardState, right: BoardState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function boardFingerprint(board: BoardState): string {
  const raw = JSON.stringify(board)
  let hash = 5381
  for (let index = 0; index < raw.length; index += 1) {
    hash = Math.imul(hash, 33) ^ raw.charCodeAt(index)
  }
  return (hash >>> 0).toString(16)
}
