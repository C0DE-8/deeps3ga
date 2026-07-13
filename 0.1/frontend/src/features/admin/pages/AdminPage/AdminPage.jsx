import { useEffect, useState } from 'react'
import { BookOpen, Brain, Crown, Database, RefreshCw, ScrollText, Skull, Users } from 'lucide-react'
import { fetchAdminDataset, fetchAdminOverview } from '../../../../api/adminApi'
import { AppHeader } from '../../../shell/AppHeader/AppHeader'
import styles from './AdminPage.module.css'

const metricIcons = { players: Users, active_runs: BookOpen, deaths: Skull, legacy_heroes: Crown, memories: Brain, narrative_messages: ScrollText }

function display(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  const text = String(value)
  return text.length > 90 ? `${text.slice(0, 90)}…` : text
}

export function AdminPage() {
  const [overview, setOverview] = useState(null)
  const [dataset, setDataset] = useState(null)
  const [selected, setSelected] = useState('players')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadOverview() {
    setLoading(true); setError('')
    try { setOverview(await fetchAdminOverview()) } catch (e) { setError(e.response?.data?.message || 'God\'s Eye could not open.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    fetchAdminOverview()
      .then(setOverview)
      .catch((e) => setError(e.response?.data?.message || 'God\'s Eye could not open.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (overview) fetchAdminDataset(selected).then(setDataset).catch((e) => setError(e.response?.data?.message || 'Dataset unavailable.')) }, [selected, overview])

  const columns = dataset?.rows?.[0] ? Object.keys(dataset.rows[0]) : []
  return (
    <main className={styles.page}>
      <AppHeader />
      <header className={styles.titlebar}><div><span>Administrator observatory</span><h1>God's Eye</h1><p>Read-only visibility across the living world and every recorded soul.</p></div><button onClick={loadOverview} disabled={loading} title="Refresh"><RefreshCw size={18} /></button></header>
      {error && <p className={styles.error}>{error}</p>}
      {overview && <>
        <section className={styles.metrics}>{Object.entries(overview.counts).map(([key, value]) => { const Icon = metricIcons[key] || Database; return <article key={key}><Icon size={19} /><span>{key.replaceAll('_', ' ')}</span><strong>{value}</strong></article> })}</section>
        <section className={styles.liveGrid}>
          <article><header><h2>Recent souls</h2><span>{overview.recentPlayers.length}</span></header>{overview.recentPlayers.map((player) => <div className={styles.row} key={player.id}><div><strong>{player.username}</strong><small>{player.email}</small></div><span>{player.role}</span></div>)}</article>
          <article><header><h2>Latest cycles</h2><span>{overview.activeRuns.length}</span></header>{overview.activeRuns.map((run) => <div className={styles.row} key={run.id}><div><strong>{run.username} · Life {run.cycle_number}</strong><small>{run.dungeon_name || 'Before awakening'} · Floor {run.floor_number || '—'}</small></div><span>{run.status}</span></div>)}</article>
          <article><header><h2>Legacy vault</h2><span>{overview.legacyHeroes.length}</span></header>{overview.legacyHeroes.length ? overview.legacyHeroes.map((hero) => <div className={styles.row} key={hero.id}><div><strong>{hero.hero_name}</strong><small>{hero.final_title}</small></div><span>#{hero.legacy_number}</span></div>) : <p className={styles.muted}>No completed legend has been sealed yet.</p>}</article>
        </section>
        <section className={styles.explorer}>
          <aside><h2>World records</h2>{overview.datasets.map((name) => <button className={selected === name ? styles.active : ''} key={name} onClick={() => setSelected(name)}>{name.replace(/([A-Z])/g, ' $1')}</button>)}</aside>
          <div className={styles.tableWrap}><header><div><span>Database view</span><h2>{selected.replace(/([A-Z])/g, ' $1')}</h2></div><small>{dataset?.total ?? 0} rows</small></header>{columns.length ? <table><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{dataset.rows.map((row, index) => <tr key={row.id || index}>{columns.map((column) => <td title={typeof row[column] === 'string' ? row[column] : ''} key={column}>{display(row[column])}</td>)}</tr>)}</tbody></table> : <p className={styles.muted}>No records in this dataset.</p>}</div>
        </section>
      </>}
    </main>
  )
}
