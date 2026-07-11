import { useEffect, useMemo, useState } from 'react'
import { getCurrentAccount, loginAccount, logoutAccount, registerAccount } from '../../api/authApi'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('deepSagaToken')))

  useEffect(() => {
    if (!localStorage.getItem('deepSagaToken')) return
    getCurrentAccount().then(setAccount).catch(() => localStorage.removeItem('deepSagaToken')).finally(() => setLoading(false))
  }, [])

  async function establish(request, payload) {
    const session = await request(payload)
    localStorage.setItem('deepSagaToken', session.token)
    setAccount(session.account)
    return session.account
  }

  async function logout() {
    try { await logoutAccount() } finally {
      localStorage.removeItem('deepSagaToken')
      setAccount(null)
    }
  }

  const value = useMemo(() => ({
    account,
    loading,
    login: (payload) => establish(loginAccount, payload),
    register: (payload) => establish(registerAccount, payload),
    logout,
  }), [account, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
