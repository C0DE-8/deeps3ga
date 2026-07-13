import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function AppHeader() {
  const { player, logout } = useAuth()

  return (
    <header className="appHeader">
      <Link className="brand" to="/library">
        <span>Deep S3GA</span>
        <strong>Deep Saga</strong>
      </Link>
      <nav aria-label="Primary navigation">
        <NavLink to="/library">Library</NavLink>
        <NavLink to="/read/current">Read</NavLink>
      </nav>
      <div className="headerAccount">
        <span>{player?.playerId}</span>
        <button type="button" onClick={logout}>Log out</button>
      </div>
    </header>
  )
}
