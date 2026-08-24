import type { TaskPriority } from './types'

const PRIORITY_CYCLE: (TaskPriority | null)[] = [null, 'p1', 'p2', 'p3']

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  p1: 'Prioridad P1',
  p2: 'Prioridad P2',
  p3: 'Prioridad P3',
}

export function getNextPriority(
  current: TaskPriority | null,
): TaskPriority | null {
  const index = PRIORITY_CYCLE.indexOf(current)
  return PRIORITY_CYCLE[(index + 1) % PRIORITY_CYCLE.length]
}

export function getPriorityLabel(priority: TaskPriority | null): string {
  if (!priority) return 'Sin prioridad'
  return PRIORITY_LABELS[priority]
}
