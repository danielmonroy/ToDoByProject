import type { BoardState, Task, TaskEffort, TaskPriority, TaskTimeOfDay } from './types'

export const AGENDA_DROPPABLE_ID = 'agenda'

export function countPendingTasks(tasks: Task[]): number {
  return tasks.filter((task) => !task.completed).length
}

export function countPendingAgendaTasks(board: BoardState): number {
  const agendaIds = new Set(board.agendaTaskIds ?? [])
  if (agendaIds.size === 0) return 0

  let count = 0
  for (const project of board.projects) {
    for (const task of project.tasks) {
      if (agendaIds.has(task.id) && !task.completed) count += 1
    }
  }
  return count
}

export function getAgendaSortableId(taskId: string): string {
  return `agenda:${taskId}`
}

export function parseAgendaSortableId(id: string): string | null {
  return id.startsWith('agenda:') ? id.slice('agenda:'.length) : null
}

export function isAgendaTarget(id: string): boolean {
  return id === AGENDA_DROPPABLE_ID || id.startsWith('agenda:')
}

const EFFORT_ORDER: Record<TaskEffort, number> = {
  m5: 0,
  m30: 1,
  h2: 2,
  h4: 3,
  h8: 4,
}

const TIME_OF_DAY_ORDER: Record<TaskTimeOfDay, number> = {
  early_morning: 0,
  morning: 1,
  afternoon: 2,
  night: 3,
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  p1: 0,
  p2: 1,
  p3: 2,
}

function rank<T extends string>(
  value: T | null | undefined,
  order: Record<T, number>,
): number {
  if (!value) return Number.POSITIVE_INFINITY
  return order[value]
}

export function compareAgendaTasks(left: Task, right: Task): number {
  const byTimeOfDay =
    rank(left.timeOfDay, TIME_OF_DAY_ORDER) -
    rank(right.timeOfDay, TIME_OF_DAY_ORDER)
  if (byTimeOfDay !== 0) return byTimeOfDay

  const byEffort =
    rank(left.effort, EFFORT_ORDER) - rank(right.effort, EFFORT_ORDER)
  if (byEffort !== 0) return byEffort

  return rank(left.priority, PRIORITY_ORDER) - rank(right.priority, PRIORITY_ORDER)
}

export function sortAgendaTasks(board: BoardState): BoardState {
  const ids = board.agendaTaskIds ?? []
  if (ids.length < 2) return board

  const tasks = new Map<string, Task>()
  for (const project of board.projects) {
    for (const task of project.tasks) {
      tasks.set(task.id, task)
    }
  }

  const sorted = [...ids].sort((leftId, rightId) => {
    const left = tasks.get(leftId)
    const right = tasks.get(rightId)
    if (!left || !right) return 0
    return compareAgendaTasks(left, right)
  })

  if (sorted.every((id, index) => id === ids[index])) return board
  return { ...board, agendaTaskIds: sorted }
}
