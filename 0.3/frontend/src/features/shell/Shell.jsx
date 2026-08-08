import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/useAuth'

export function Shell({ children }) {
  const { player, logout } = useAuth()

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/library">
          <strong>DEEP SAGA</strong>
          <span>Interactive fantasy books</span>
        </Link>
        <div className="nav-actions">
          {player && <span className="meta">{player.username}</span>}
          <button className="icon-button" onClick={logout} title="Logout" aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      {children}
    </main>
  )
}
