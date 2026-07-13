import { BookOpen, Eye, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import styles from './AppHeader.module.css'

export function AppHeader({ compact = false }) {
  const { account, logout } = useAuth()
  const navigate = useNavigate()
  async function signOut() { await logout(); navigate('/login') }
  return (
    <header className={`${styles.header} ${compact ? styles.compact : ''}`}>
      <Link className={styles.brand} to={account?.role === 'admin' ? '/admin' : '/library'}><Eye size={20} /><span>Deep Saga</span></Link>
      <nav>
        {account?.role === 'admin' ? <Link to="/admin"><Eye size={17} /> God's Eye</Link> : <Link to="/library"><BookOpen size={17} /> My stories</Link>}
        <span className={styles.identity}>{account?.username}</span>
        <button type="button" onClick={signOut} title="Sign out"><LogOut size={18} /></button>
      </nav>
    </header>
  )
}
