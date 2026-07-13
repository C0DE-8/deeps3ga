import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PortalLines } from '../../../components/PortalLines/PortalLines'
import { useAuth } from '../useAuth'

export function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { player, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', identifier: '', password: '' })
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
        ? register({ email: form.email, password: form.password })
        : login({ identifier: form.identifier, password: form.password }))
      navigate(location.state?.from || '/library', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'The soul archive refused the request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="authPage">
      <PortalLines />
      <section className="authIntro">
        <span>Deep Saga access</span>
        <h1>{isRegister ? 'A new soul enters the archive.' : 'The dungeon remembers you.'}</h1>
        <p>
          Register with email and password to receive a Player ID. Return later with either
          your email or Player ID and the same password.
        </p>
      </section>

      <form className="authForm" onSubmit={submit}>
        <div className="authTabs">
          <Link className={isRegister ? 'active' : ''} to="/register">Register</Link>
          <Link className={!isRegister ? 'active' : ''} to="/login">Login</Link>
        </div>

        <div className="formTitle">
          <span>{isRegister ? 'First reincarnation' : 'Soul return'}</span>
          <h2>{isRegister ? 'Create player record' : 'Resume playthrough'}</h2>
        </div>

        {isRegister ? (
          <label>
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={update} required autoComplete="email" placeholder="you@example.com" />
          </label>
        ) : (
          <label>
            <span>Email or Player ID</span>
            <input name="identifier" value={form.identifier} onChange={update} required autoComplete="username" placeholder="you@example.com or DS-XXXXXXXXXX" />
          </label>
        )}

        <label>
          <span>Password</span>
          <input name="password" type="password" minLength="8" value={form.password} onChange={update} required autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="At least 8 characters" />
        </label>

        {error && <p className="formError" role="alert">{error}</p>}

        <button className="primaryButton" type="submit" disabled={busy}>
          {busy ? 'Opening archive...' : isRegister ? 'Register and reincarnate' : 'Login'}
        </button>

        <p className="switchLink">
          {isRegister ? 'Already have a Player ID?' : 'No player record yet?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Login' : 'Register'}</Link>
        </p>
      </form>
    </main>
  )
}
