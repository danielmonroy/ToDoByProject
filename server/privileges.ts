import { lchownSync, lstatSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const DROP_UID = 1000
const DROP_GID = 1000

function chownTree(target: string): void {
  lchownSync(target, DROP_UID, DROP_GID)
  if (!lstatSync(target).isDirectory()) return
  for (const entry of readdirSync(target)) {
    chownTree(path.join(target, entry))
  }
}

export function dropRootForDataDir(dataDir: string): void {
  const getuid = process.getuid
  const setgid = process.setgid
  const setuid = process.setuid
  if (typeof getuid !== 'function' || typeof setgid !== 'function' || typeof setuid !== 'function') return
  if (getuid() !== 0) return

  mkdirSync(dataDir, { recursive: true })
  chownTree(dataDir)
  setgid(DROP_GID)
  setuid(DROP_UID)
}

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
