import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function passwordMatches(input: string, expected: string): boolean {
  const left = createHash('sha256').update(input, 'utf8').digest()
  const right = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(left, right)
}

export function createSessionToken(secret: string, now = Date.now(), ttlMs = SESSION_TTL_MS): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + ttlMs }), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifySessionToken(secret: string, token: string, now = Date.now()): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [payload, signature] = parts
  if (!payload || !signature) return false

  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return false
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof parsed.exp === 'number' && parsed.exp > now
  } catch {
    return false
  }
}
