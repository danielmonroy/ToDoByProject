export type TaskPriority = 'p1' | 'p2' | 'p3'

export type TaskEffort = 'm5' | 'm30' | 'h2' | 'h4' | 'h8'

export type TaskTimeOfDay = 'early_morning' | 'morning' | 'afternoon' | 'night'

export type Task = {
  id: string
  title: string
  completed: boolean
  priority: TaskPriority | null
  effort: TaskEffort | null
  timeOfDay: TaskTimeOfDay | null
}

export type Project = {
  id: string
  name: string
  tasks: Task[]
}

export type BoardState = {
  version: 1
  projects: Project[]
  agendaTaskIds: string[]
}
