import { useCallback, useEffect, useRef, useState } from 'react'
import { isUnauthorized, putBoard } from './api'
import type { BoardState } from './types'

export type SyncState = 'idle' | 'saving' | 'saved' | 'error'

type UseServerSyncOptions = {
  board: BoardState | null
  enabled: boolean
  onUnauthorized: () => void
}

export function useServerSync({ board, enabled, onUnauthorized }: UseServerSyncOptions) {
  const boardRef = useRef(board)
  const onUnauthorizedRef = useRef(onUnauthorized)
  const baselineRef = useRef<string | null>(null)
  const tail = useRef<Promise<void>>(Promise.resolve())
  const cancelPending = useRef<(() => void) | null>(null)
  const [sync, setSync] = useState<SyncState>('idle')
  const [baseline, setBaseline] = useState<string | null>(null)

  useEffect(() => {
    boardRef.current = board
    onUnauthorizedRef.current = onUnauthorized
  })

  const remember = useCallback((serial: string, status: SyncState) => {
    baselineRef.current = serial
    setBaseline(serial)
    setSync(status)
  }, [])

  const markSaved = useCallback(
    (value: BoardState) => {
      remember(JSON.stringify(value), 'saved')
    },
    [remember],
  )

  const saveLatest = useCallback(() => {
    const run = tail.current.catch(() => undefined).then(async () => {
      const current = boardRef.current
      if (!current) return
      const serial = JSON.stringify(current)
      if (baselineRef.current === serial) return

      setSync('saving')
      try {
        await putBoard(current)
      } catch (error) {
        if (isUnauthorized(error)) onUnauthorizedRef.current()
        else setSync('error')
        return
      }

      if (boardRef.current && JSON.stringify(boardRef.current) === serial) {
        remember(serial, 'saved')
      }
    })

    tail.current = run
    return run
  }, [remember])

  const flush = useCallback(() => {
    cancelPending.current?.()
    return saveLatest()
  }, [saveLatest])

  const retry = useCallback(() => {
    void saveLatest()
  }, [saveLatest])

  useEffect(() => {
    if (!enabled || !board) return

    const serial = JSON.stringify(board)
    if (baselineRef.current === null) {
      baselineRef.current = serial
      return
    }
    if (baselineRef.current === serial) return

    const timer = window.setTimeout(() => {
      void saveLatest()
    }, 400)
    cancelPending.current = () => window.clearTimeout(timer)

    return () => {
      window.clearTimeout(timer)
      cancelPending.current = null
    }
  }, [board, enabled, saveLatest])

  const currentSerial = board ? JSON.stringify(board) : null
  const unsaved = baseline !== null && currentSerial !== null && currentSerial !== baseline

  return { sync, unsaved, retry, markSaved, flush }
}
