import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseBoard } from '../shared/board.ts'
import type { BoardState } from '../src/types.ts'

const tails = new Map<string, Promise<unknown>>()

export class InvalidBoardError extends Error {
  constructor() {
    super('El tablero no tiene un formato válido.')
    this.name = 'InvalidBoardError'
  }
}

function enqueue<T>(key: string, task: () => T | Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve()
  const result = previous.then(task, task)
  tails.set(
    key,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
}

export function boardFile(dataDir: string): string {
  return path.join(dataDir, 'board.json')
}

function readBoardFileSync(file: string): BoardState | null {
  if (!existsSync(file)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new Error(`El archivo ${file} no es JSON válido. No se ha modificado.`)
  }

  const board = parseBoard(parsed)
  if (!board) {
    throw new Error(`El archivo ${file} no tiene un tablero válido. No se ha modificado.`)
  }
  return board
}

export function readBoardFile(file: string): Promise<BoardState | null> {
  return enqueue(file, () => readBoardFileSync(file))
}

export function writeBoardFile(file: string, board: BoardState): Promise<BoardState> {
  const normalized = parseBoard(board)
  if (!normalized) return Promise.reject(new InvalidBoardError())

  return enqueue(file, () => {
    mkdirSync(path.dirname(file), { recursive: true })
    if (existsSync(file)) copyFileSync(file, `${file}.bak`)
    const temporary = `${file}.${process.pid}.tmp`
    writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
    renameSync(temporary, file)
    return normalized
  })
}

export function readBoard(dataDir: string): Promise<BoardState | null> {
  return readBoardFile(boardFile(dataDir))
}

export function writeBoard(dataDir: string, board: BoardState): Promise<BoardState> {
  return writeBoardFile(boardFile(dataDir), board)
}
