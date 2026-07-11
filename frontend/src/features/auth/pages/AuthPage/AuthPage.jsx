import { useState } from 'react'
import { BookOpen, Eye, KeyRound, Mail, UserRound } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../useAuth'
import styles from './AuthPage.module.css'

export function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { account, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', email: '', identifier: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (account) return <Navigate to={account.role === 'admin' ? '/admin' : '/library'} replace />

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const nextAccount = isRegister
        ? await register({ username: form.username, email: form.email, password: form.password })
        : await login({ identifier: form.identifier, password: form.password })
      const destination = location.state?.from || (nextAccount.role === 'admin' ? '/admin' : '/library')
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The gate did not recognize this soul.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <section className={styles.intro}>
        <span className={styles.mark}><Eye size={18} /> Deep Saga</span>
        <h1>{isRegister ? 'A new soul approaches.' : 'The Dungeon remembers you.'}</h1>
        <p>Enter the living record. Every choice becomes history, and every completed life waits at the end of another.</p>
      </section>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formHead}>
          <BookOpen size={24} />
          <div><span>Soul archive</span><h2>{isRegister ? 'Manifest a soul' : 'Resume your legend'}</h2></div>
        </div>
        {isRegister ? (
          <>
            <label><span><UserRound size={15} /> Soul name</span><input name="username" value={form.username} onChange={update} minLength="3" required autoComplete="username" /></label>
            <label><span><Mail size={15} /> Email</span><input name="email" type="email" value={form.email} onChange={update} required autoComplete="email" /></label>
          </>
        ) : (
          <label><span><UserRound size={15} /> Soul identifier</span><input name="identifier" value={form.identifier} onChange={update} required autoComplete="username" placeholder="Username or email" /></label>
        )}
        <label><span><KeyRound size={15} /> Secret key</span><input name="password" type="password" value={form.password} onChange={update} minLength="8" required autoComplete={isRegister ? 'new-password' : 'current-password'} /></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.submit} disabled={busy}>{busy ? 'Opening the record...' : isRegister ? 'Begin this soul' : 'Enter Deep Saga'}</button>
        <p className={styles.switch}>{isRegister ? 'Already remembered?' : 'No soul record yet?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Register'}</Link></p>
      </form>
    </main>
  )
}
