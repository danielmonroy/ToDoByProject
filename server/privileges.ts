import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function assertDataDirWritable(dataDir: string): void {
  mkdirSync(dataDir, { recursive: true })
  const probe = path.join(dataDir, '.write-probe')
  try {
    writeFileSync(probe, 'ok')
    unlinkSync(probe)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'permiso denegado'
    throw new Error(`No se puede escribir en ${dataDir} (${detail}).`)
  }
}
