import type { BoardState } from './types'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  const body: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'No se pudo completar la solicitud.'
    throw new ApiError(response.status, message)
  }

  return body as T
}

export function fetchSession(): Promise<{ authenticated: boolean }> {
  return request('/api/session')
}

export function login(password: string): Promise<{ ok: boolean }> {
  return request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function logout(): Promise<{ ok: boolean }> {
  return request('/api/logout', { method: 'POST' })
}

export async function fetchBoard(): Promise<BoardState | null> {
  const body = await request<{ board: BoardState | null }>('/api/board')
  return body.board
}

export async function putBoard(board: BoardState): Promise<BoardState> {
  const body = await request<{ board: BoardState }>('/api/board', {
    method: 'PUT',
    body: JSON.stringify(board),
  })
  return body.board
}
