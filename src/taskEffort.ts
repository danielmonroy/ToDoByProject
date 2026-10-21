import type { TaskEffort } from './types'

const EFFORT_CYCLE: (TaskEffort | null)[] = [null, 'm5', 'm30', 'h2', 'h4', 'h8']

const EFFORT_LABELS: Record<TaskEffort, string> = {
  m5: '5 minutos',
  m30: '30 minutos',
  h2: '2 horas',
  h4: '4 horas',
  h8: '8 horas',
}

const EFFORT_SHORT_LABELS: Record<TaskEffort, string> = {
  m5: '5 min',
  m30: '30 min',
  h2: '2 h',
  h4: '4 h',
  h8: '8 h',
}

const EFFORT_LEVELS: Record<TaskEffort, number> = {
  m5: 1,
  m30: 2,
  h2: 3,
  h4: 4,
  h8: 5,
}

const EFFORT_MINUTES: Record<TaskEffort, number> = {
  m5: 5,
  m30: 30,
  h2: 120,
  h4: 240,
  h8: 480,
}

export function getNextEffort(current: TaskEffort | null): TaskEffort | null {
  const index = EFFORT_CYCLE.indexOf(current)
  const safeIndex = index === -1 ? 0 : index
  return EFFORT_CYCLE[(safeIndex + 1) % EFFORT_CYCLE.length]
}

export function getEffortLabel(effort: TaskEffort | null): string {
  if (!effort) return 'Sin estimación'
  return EFFORT_LABELS[effort]
}

export function getEffortShortLabel(effort: TaskEffort): string {
  return EFFORT_SHORT_LABELS[effort]
}

export function getEffortLevel(effort: TaskEffort): number {
  return EFFORT_LEVELS[effort]
}

export function getEffortMinutes(effort: TaskEffort): number {
  return EFFORT_MINUTES[effort]
}

export function formatBudgetedMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}
