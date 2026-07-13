import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CirclePlus, Crown, Skull } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchPersonas, updateNarratorPersona } from '../../../api/authApi'
import { fetchGameSaves, startGame } from '../../../api/deepSagaApi'
import { useAuth } from '../../auth/useAuth'
import { AppHeader } from '../../shell/AppHeader'
import styles from './LibraryPage.module.css'

export function LibraryPage() {
  const { player, setPlayer } = useAuth()
  const [saves, setSaves] = useState([])
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [personaSaving, setPersonaSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([fetchGameSaves(), fetchPersonas()])
      .then(([saveList, personaResponse]) => {
        setSaves(saveList)
        setPersonas(personaResponse.data.personas || [])
      })
      .catch((e) => setError(e.message || 'The archive could not be opened.'))
      .finally(() => setLoading(false))
  }, [])

  async function begin() {
    setLoading(true)
    try { const game = await startGame(); navigate(`/read/${game.storyCycleId}`) }
    catch (e) { setError(e.message || 'A new life could not begin.'); setLoading(false) }
  }

  async function changePersona(event) {
    const nextPersona = event.target.value
    setPersonaSaving(true)
    setError('')

    try {
      const response = await updateNarratorPersona(nextPersona)
      setPlayer(response.data.player)
    } catch (e) {
      setError(e.message || 'The narrator persona could not be changed.')
    } finally {
      setPersonaSaving(false)
    }
  }

  const active = saves.find((save) => ['opening_death', 'awake', 'in_progress'].includes(save.status))
  return (
    <main className={styles.page}>
      <AppHeader />
      <section className={styles.hero}>
        <p>Your soul archive</p>
        <h1>Every life leaves a page behind.</h1>
        <div className={styles.personaPanel}>
          <label htmlFor="narrator-persona">
            <span>Narrator persona</span>
            <select id="narrator-persona" value={player?.narratorPersona || 'ADMIN'} onChange={changePersona} disabled={personaSaving || !personas.length}>
              {(personas.length ? personas : [{ key: 'ADMIN', name: 'The Divine Administrator' }]).map((persona) => (
                <option key={persona.key} value={persona.key}>{persona.name}</option>
              ))}
            </select>
          </label>
          <p>{personas.find((persona) => persona.key === (player?.narratorPersona || 'ADMIN'))?.description || 'Choose how Deep Saga speaks to you.'}</p>
        </div>
        <button onClick={active ? () => navigate(`/read/${active.story_cycle_id}`) : begin} disabled={loading}>
          {active ? <BookOpen size={19} /> : <CirclePlus size={19} />}{active ? 'Continue reading' : 'Begin a new life'}
        </button>
      </section>
      <section className={styles.shelf}>
        <header><div><span>Recorded lives</span><h2>Your stories</h2></div><small>{saves.length} records</small></header>
        {error && <p className={styles.error}>{error}</p>}
        {!loading && !saves.length && <div className={styles.empty}><BookOpen size={30} /><h3>No story has been written yet.</h3><p>Your first page always begins with the last breath of another life.</p></div>}
        <div className={styles.list}>
          {saves.map((save) => (
            <article key={save.story_cycle_id}>
              <div className={styles.recordIcon}>{save.status === 'dead' ? <Skull /> : save.status === 'completed' ? <Crown /> : <BookOpen />}</div>
              <div className={styles.recordTitle}><span>Life {save.cycle_number}</span><h3>{save.character_name || 'Unmanifested soul'}</h3><p>{save.race_name} {save.class_name} · Level {save.level || 1}</p></div>
              <div className={styles.location}><span>{save.dungeon_name || 'Before awakening'}</span><p>{save.floor_name || 'The Last Breath'}</p></div>
              <span className={`${styles.status} ${styles[save.status] || ''}`}>{save.status.replace('_', ' ')}</span>
              {['opening_death', 'awake', 'in_progress'].includes(save.status) && <button className={styles.open} onClick={() => navigate(`/read/${save.story_cycle_id}`)} title="Open story"><ArrowRight size={19} /></button>}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
