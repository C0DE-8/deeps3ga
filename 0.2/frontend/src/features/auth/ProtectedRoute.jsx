import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute({ children }) {
  const { player, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className="routeLoading">Opening the soul archive...</main>
  if (!player) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return children
}
