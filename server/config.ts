import path from 'node:path'

export type SecureCookie = true | false | 'auto'

export type AppConfig = {
  password: string
  sessionSecret: string
  dataDir: string
  staticDir: string
  host: string
  port: number
  trustProxy: boolean
  secureCookie: SecureCookie
  isProduction: boolean
}

const REJECTED_PASSWORDS = new Set([
  'cambia-esta-clave',
  'dev-password',
  'changeme',
  'password',
])

const REJECTED_SECRETS = new Set([
  'cambia-este-secreto-largo',
  'dev-session-secret',
])

function flag(value: string | undefined): boolean | null {
  if (value === undefined || value === '') return null
  if (value === '1' || value === 'true' || value === 'yes') return true
  if (value === '0' || value === 'false' || value === 'no') return false
  return null
}

export function resolveConfig(
  env: Record<string, string | undefined>,
): { config: AppConfig } | { error: string } {
  const isProduction = env.NODE_ENV === 'production'
  let password = env.APP_PASSWORD ?? ''
  let sessionSecret = env.SESSION_SECRET ?? ''

  if (!isProduction) {
    if (!password) password = 'dev-password'
    if (!sessionSecret) sessionSecret = 'dev-session-secret'
  }

  if (!password) {
    return { error: 'Define APP_PASSWORD. Es la clave con la que vas a entrar al tablero.' }
  }

  if (isProduction && (password.length < 8 || REJECTED_PASSWORDS.has(password))) {
    return {
      error: 'APP_PASSWORD debe tener al menos 8 caracteres y no puede ser la contraseña de ejemplo.',
    }
  }

  if (!sessionSecret) {
    return { error: 'Define SESSION_SECRET con una cadena aleatoria de al menos 16 caracteres.' }
  }

  if (isProduction && (sessionSecret.length < 16 || REJECTED_SECRETS.has(sessionSecret))) {
    return {
      error: 'SESSION_SECRET debe tener al menos 16 caracteres y no puede ser el valor de ejemplo.',
    }
  }

  const port = Number(env.PORT ?? '3000')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'PORT tiene que ser un número entero entre 1 y 65535.' }
  }

  const secureFlag = flag(env.COOKIE_SECURE)

  return {
    config: {
      password,
      sessionSecret,
      dataDir: path.resolve(env.DATA_DIR ?? 'data'),
      staticDir: path.resolve(env.STATIC_DIR ?? 'dist'),
      host: env.HOST ?? '0.0.0.0',
      port,
      trustProxy: flag(env.TRUST_PROXY) === true,
      secureCookie: secureFlag === null ? 'auto' : secureFlag,
      isProduction,
    },
  }
}
