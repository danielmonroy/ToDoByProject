import type { BoardState, Task } from './types'

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
