import { useEffect, useMemo, useState } from 'react'
import { fetchCurrentPlayer, loginPlayer, registerPlayer } from '../../api/authApi'
import { getStoredToken, setStoredToken } from '../../api/httpClient'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()))

  useEffect(() => {
    let ignore = false

    async function restoreSession() {
      if (!getStoredToken()) {
        setLoading(false)
        return
      }

      try {
        const payload = await fetchCurrentPlayer()
        if (!ignore) setPlayer(payload.data.player)
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

  async function establish(request, payload) {
    const response = await request(payload)
    setStoredToken(response.data.token)
    setPlayer(response.data.player)
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
  }), [player, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
