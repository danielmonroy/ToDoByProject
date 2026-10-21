import type { TaskTimeOfDay } from './types'

const TIME_OF_DAY_CYCLE: (TaskTimeOfDay | null)[] = [
  null,
  'early_morning',
  'morning',
  'afternoon',
  'night',
]

const TIME_OF_DAY_LABELS: Record<TaskTimeOfDay, string> = {
  early_morning: 'Madrugada',
  morning: 'Mañana',
  afternoon: 'Tarde',
  night: 'Noche',
}

export function getNextTimeOfDay(
  current: TaskTimeOfDay | null,
): TaskTimeOfDay | null {
  const index = TIME_OF_DAY_CYCLE.indexOf(current)
  const safeIndex = index === -1 ? 0 : index
  return TIME_OF_DAY_CYCLE[(safeIndex + 1) % TIME_OF_DAY_CYCLE.length]
}

export function getTimeOfDayLabel(timeOfDay: TaskTimeOfDay | null): string {
  if (!timeOfDay) return 'Sin momento del día'
  return TIME_OF_DAY_LABELS[timeOfDay]
}
