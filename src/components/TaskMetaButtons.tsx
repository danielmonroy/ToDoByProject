import type { TaskEffort, TaskPriority, TaskTimeOfDay } from '../types'
import { getEffortLabel, getEffortLevel, getEffortShortLabel, getNextEffort } from '../taskEffort'
import { getNextPriority, getPriorityLabel } from '../taskPriority'
import { getNextTimeOfDay, getTimeOfDayLabel } from '../taskTimeOfDay'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function TimeOfDayIcon({ timeOfDay }: { timeOfDay: TaskTimeOfDay | null }) {
  if (timeOfDay === 'early_morning') {
    return (
      <svg {...iconProps}>
        <path d="M12 10V7" />
        <path d="m8.2 11.2-1.6-1.6" />
        <path d="m15.8 11.2 1.6-1.6" />
        <path d="M4 18h16" />
        <path d="M7 18a5 5 0 0 1 10 0" />
      </svg>
    )
  }

  if (timeOfDay === 'morning') {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3.25" />
        <path d="M12 3.5v2.2" />
        <path d="M12 18.3v2.2" />
        <path d="M3.5 12h2.2" />
        <path d="M18.3 12h2.2" />
        <path d="m6 6 1.6 1.6" />
        <path d="m16.4 16.4 1.6 1.6" />
        <path d="m18 6-1.6 1.6" />
        <path d="m7.6 16.4-1.6 1.6" />
      </svg>
    )
  }

  if (timeOfDay === 'afternoon') {
    return (
      <svg {...iconProps}>
        <path d="M12 3v2" />
        <path d="m4.9 4.9 1.4 1.4" />
        <path d="M20 12h2" />
        <path d="m19.1 4.9-1.4 1.4" />
        <path d="M15.9 12.7a4 4 0 0 0-5.9-4.1" />
        <path d="M13 21H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z" />
      </svg>
    )
  }

  if (timeOfDay === 'night') {
    return (
      <svg {...iconProps}>
        <path d="M21 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 21 16.8" />
      </svg>
    )
  }

  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5v1.5" />
      <path d="M12 17.5V19" />
      <path d="M5 12h1.5" />
      <path d="M17.5 12H19" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function priorityClass(priority: TaskPriority | null): string {
  return `task-card__priority ${priority ? `task-card__priority--${priority}` : 'task-card__priority--none'}`
}

function effortClass(effort: TaskEffort | null): string {
  return `task-card__effort ${effort ? `task-card__effort--${effort}` : 'task-card__effort--none'}`
}

function timeClass(timeOfDay: TaskTimeOfDay | null): string {
  return `task-card__time ${timeOfDay ? `task-card__time--${timeOfDay}` : 'task-card__time--none'}`
}

function EffortContent({ effort }: { effort: TaskEffort | null }) {
  if (!effort) return <ClockIcon />

  return (
    <>
      <span className="task-card__effort-meter" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={index < getEffortLevel(effort) ? 'is-filled' : undefined}
          />
        ))}
      </span>
      {getEffortShortLabel(effort)}
    </>
  )
}

type TaskMetaButtonsProps = {
  priority: TaskPriority | null
  effort: TaskEffort | null
  timeOfDay: TaskTimeOfDay | null
  onSetPriority: (priority: TaskPriority | null) => void
  onSetEffort: (effort: TaskEffort | null) => void
  onSetTimeOfDay: (timeOfDay: TaskTimeOfDay | null) => void
  layout?: 'toolbar' | 'fields'
}

export function TaskMetaButtons({
  priority,
  effort,
  timeOfDay,
  onSetPriority,
  onSetEffort,
  onSetTimeOfDay,
  layout = 'toolbar',
}: TaskMetaButtonsProps) {
  const cyclePriority = () => onSetPriority(getNextPriority(priority))
  const cycleEffort = () => onSetEffort(getNextEffort(effort))
  const cycleTimeOfDay = () => onSetTimeOfDay(getNextTimeOfDay(timeOfDay))

  if (layout === 'fields') {
    return (
      <div className="task-meta-fields">
        <button
          type="button"
          className="task-meta-fields__item"
          onClick={cyclePriority}
          aria-label={`${getPriorityLabel(priority)}. Clic para cambiar.`}
        >
          <span className="task-meta-fields__name">Importancia</span>
          <span className={priorityClass(priority)} aria-hidden="true" />
          <span className="task-meta-fields__value">{getPriorityLabel(priority)}</span>
        </button>
        <button
          type="button"
          className="task-meta-fields__item"
          onClick={cycleEffort}
          aria-label={`${getEffortLabel(effort)}. Clic para cambiar.`}
        >
          <span className="task-meta-fields__name">Tiempo</span>
          <span className={effortClass(effort)} aria-hidden="true">
            <EffortContent effort={effort} />
          </span>
          <span className="task-meta-fields__value">{getEffortLabel(effort)}</span>
        </button>
        <button
          type="button"
          className="task-meta-fields__item"
          onClick={cycleTimeOfDay}
          aria-label={`${getTimeOfDayLabel(timeOfDay)}. Clic para cambiar.`}
        >
          <span className="task-meta-fields__name">Momento</span>
          <span className={timeClass(timeOfDay)} aria-hidden="true">
            <TimeOfDayIcon timeOfDay={timeOfDay} />
          </span>
          <span className="task-meta-fields__value">{getTimeOfDayLabel(timeOfDay)}</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className={priorityClass(priority)}
        onClick={cyclePriority}
        aria-label={`${getPriorityLabel(priority)}. Clic para cambiar.`}
        title={getPriorityLabel(priority)}
      />
      <button
        type="button"
        className={effortClass(effort)}
        onClick={cycleEffort}
        aria-label={`${getEffortLabel(effort)}. Clic para cambiar.`}
        title={getEffortLabel(effort)}
      >
        <EffortContent effort={effort} />
      </button>
      <button
        type="button"
        className={timeClass(timeOfDay)}
        onClick={cycleTimeOfDay}
        aria-label={`${getTimeOfDayLabel(timeOfDay)}. Clic para cambiar.`}
        title={getTimeOfDayLabel(timeOfDay)}
      >
        <TimeOfDayIcon timeOfDay={timeOfDay} />
      </button>
    </>
  )
}
