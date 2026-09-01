export type TaskPriority = 'p1' | 'p2' | 'p3'

export type Task = {
  id: string
  title: string
  completed: boolean
  priority: TaskPriority | null
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
