import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import styles from './ProtectedRoute.module.css'

export function ProtectedRoute({ children }) {
  const { player, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className={styles.loading}>Opening the soul archive...</main>
  if (!player) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return children
}
