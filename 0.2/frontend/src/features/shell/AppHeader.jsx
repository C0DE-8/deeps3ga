import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import styles from './AppHeader.module.css'

export function AppHeader() {
  const { player, logout } = useAuth()

  return (
    <header className={styles.header}>
      <Link className={styles.brand} to="/library">
        <span>Deep S3GA</span>
        <strong>Deep Saga</strong>
      </Link>
      <nav aria-label="Primary navigation">
        <NavLink className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink} to="/library">Library</NavLink>
      </nav>
      <div className={styles.account}>
        <span>{player?.username || player?.playerId}</span>
        <button type="button" onClick={logout}>Log out</button>
      </div>
    </header>
  )
}
