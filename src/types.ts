export type Task = {
  id: string
  title: string
  completed: boolean
}

export type Project = {
  id: string
  name: string
  tasks: Task[]
}

export type BoardState = {
  version: 1
  projects: Project[]
}
