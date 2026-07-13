import { useEffect, useMemo, useState } from 'react'
import { fetchAuthStatus, loginPlayer, registerPlayer } from '../../api/authApi'
import { clearAuthNotice, consumeAuthNotice, getStoredToken, setStoredToken } from '../../api/httpClient'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()))
  const [sessionNotice, setSessionNotice] = useState(() => consumeAuthNotice())

  useEffect(() => {
    let ignore = false

    async function restoreSession() {
      if (!getStoredToken()) {
        setLoading(false)
        return
      }

      try {
        const payload = await fetchAuthStatus()
        if (!payload.authenticated) {
          setStoredToken(null)
          if (!ignore) setSessionNotice(payload.message || 'Your session has expired. Log in again to continue your story.')
        } else if (!ignore) {
          clearAuthNotice()
          setSessionNotice('')
          setPlayer(payload.data.player)
        }
      } catch {
        setStoredToken(null)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    restoreSession()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    function expireSession() {
      setPlayer(null)
      setLoading(false)
      setSessionNotice(consumeAuthNotice() || 'Your session has expired. Log in again to continue your story.')
    }

    window.addEventListener('deep-saga:unauthorized', expireSession)
    return () => window.removeEventListener('deep-saga:unauthorized', expireSession)
  }, [])

  async function establish(request, payload) {
    const response = await request(payload)
    setStoredToken(response.data.token)
    clearAuthNotice()
    setPlayer(response.data.player)
    setSessionNotice('')
    return response.data.player
  }

  function logout() {
    setStoredToken(null)
    setPlayer(null)
  }

  const value = useMemo(() => ({
    player,
    loading,
    login: (payload) => establish(loginPlayer, payload),
    register: (payload) => establish(registerPlayer, payload),
    logout,
    setPlayer,
    sessionNotice,
  }), [player, loading, sessionNotice])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
