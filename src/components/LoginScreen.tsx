import { useState } from 'react'
import { login } from '../api'

type LoginScreenProps = {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await login(password)
      onSuccess()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo entrar.')
      setSubmitting(false)
    }
  }

  return (
    <div className="gate">
      <form className="panel" onSubmit={handleSubmit}>
        <h1 className="panel__title">Mapa mental de proyectos y tareas</h1>
        <p className="panel__text">
          Entra con tu contraseña para ver el tablero. Los datos se guardan en el servidor, así que son los mismos desde cualquier dispositivo.
        </p>
        <label className="field">
          <span className="field__label">Contraseña</span>
          <input
            className="field__input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button" type="submit" disabled={submitting || password.length === 0}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        {import.meta.env.DEV ? (
          <p className="panel__hint">
            En desarrollo, si no definiste APP_PASSWORD, la clave es dev-password.
          </p>
        ) : null}
      </form>
    </div>
  )
}
