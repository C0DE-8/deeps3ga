import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../useAuth'

export function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { player, login, register, sessionNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', email: '', identifier: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (player) return <Navigate to="/library" replace />

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await (isRegister
        ? register({ username: form.username, email: form.email, password: form.password })
        : login({ identifier: form.identifier, password: form.password }))
      navigate(location.state?.from || '/library', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="eyebrow">Deep Saga access</p>
        <h1>{isRegister ? 'Enter Deep Saga' : 'Return to Deep Saga'}</h1>
        <p>Create an account first. Story bodies are created only when you start a book run.</p>

        <form onSubmit={submit}>
          <div className="row">
            <Link className={isRegister ? 'button' : 'ghost-button'} to="/register">Register</Link>
            <Link className={!isRegister ? 'button' : 'ghost-button'} to="/login">Login</Link>
          </div>

          {sessionNotice && <p className="notice" role="status">{sessionNotice}</p>}

          {isRegister ? (
            <>
              <input name="username" value={form.username} onChange={update} required autoComplete="username" minLength="3" maxLength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="Username" />
              <input name="email" type="email" value={form.email} onChange={update} required autoComplete="email" placeholder="Email" />
            </>
          ) : (
            <input name="identifier" value={form.identifier} onChange={update} required autoComplete="username" placeholder="Username or email" />
          )}

          <input name="password" type="password" minLength="8" value={form.password} onChange={update} required autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="Password" />

          {error && <p className="notice" role="alert">{error}</p>}

          <button className="button" type="submit" disabled={busy}>
            {busy ? 'Opening...' : isRegister ? 'Create Account' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  )
}
