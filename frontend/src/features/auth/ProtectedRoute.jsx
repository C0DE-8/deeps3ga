import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute({ children, admin = false }) {
  const { account, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="route-loading">The record is opening...</main>
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && account.role !== 'admin') return <Navigate to="/library" replace />
  return children
}
