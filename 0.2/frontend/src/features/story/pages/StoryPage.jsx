import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, BookOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { continueNarrative, fetchGameState, startGame } from '../../../api/deepSagaApi'
import { AppHeader } from '../../shell/AppHeader'
import styles from './StoryPage.module.css'

function latestChoices(state) {
  const narrator = [...(state?.narrativeHistory || [])].reverse().find((message) => message.speaker === 'narrator')
  return Array.isArray(narrator?.choices_json) ? narrator.choices_json : []
}

function storyEntries(state) {
  return (state?.narrativeHistory || []).filter((message) => ['player', 'narrator'].includes(message.speaker))
}

export function StoryPage() {
  const { cycleId } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState(null)
  const [choices, setChoices] = useState([])
  const [action, setAction] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const endRef = useRef(null)

  async function loadStory(id) {
    const loaded = await fetchGameState(id)
    setGame(loaded)
    setChoices(latestChoices(loaded))
  }

  useEffect(() => {
    let active = true

    async function open() {
      setBusy(true)
      setError('')
      try {
        const loaded = await fetchGameState(cycleId)
        if (!active) return
        setGame(loaded)
        setChoices(latestChoices(loaded))
      } catch (requestError) {
        if (requestError.status !== 404) {
          if (active) setError(requestError.message || 'This story could not be opened.')
          return
        }
        try {
          const started = await startGame()
          if (active) navigate(`/read/${started.storyCycleId}`, { replace: true })
        } catch (startError) {
          if (active) setError(startError.message || 'A new story could not begin.')
        }
      } finally {
        if (active) setBusy(false)
      }
    }

    open()
    return () => { active = false }
  }, [cycleId, navigate])

  const messages = useMemo(() => storyEntries(game), [game])
  const sheet = game?.characterSheet
  const ended = game?.run?.character_status !== 'alive' || game?.run?.status === 'completed'

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  async function submit(playerAction, actionKind = 'typed', selectedTarget = null) {
    if (busy || !playerAction.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await continueNarrative({
        storyCycleId: Number(cycleId),
        playerAction: playerAction.trim(),
        actionKind,
        selectedTarget,
        requestKey: crypto.randomUUID(),
      })
      setAction('')
      setChoices(result.choices || [])
      await loadStory(cycleId)
    } catch (requestError) {
      setError(requestError.message || 'The narrator fell silent.')
    } finally {
      setBusy(false)
    }
  }

  const initialStory = game?.currentFloor?.description || 'Your last breath is gone. Cold earth and an unfamiliar body remain.'

  return (
    <main className={styles.page}>
      <AppHeader />
      {sheet && (
        <div className={styles.statusBar}>
          <span><small>HP</small><strong>{sheet.hp}/{sheet.max_hp}</strong></span>
          <span><small>Mana</small><strong>{sheet.mana}/{sheet.max_mana}</strong></span>
          <span><small>Stamina</small><strong>{sheet.stamina}/{sheet.max_stamina}</strong></span>
          <span><small>Level</small><strong>{sheet.level}</strong></span>
          <span className={styles.position}><small>Current location</small><strong>{game.currentDungeon.name} · Floor {game.currentFloor.floor_number}</strong></span>
          <button type="button" onClick={() => setSheetOpen((open) => !open)} title={sheetOpen ? 'Close character sheet' : 'Open character sheet'}>
            {sheetOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </button>
        </div>
      )}

      <aside className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ''}`} aria-hidden={!sheetOpen}>
        {sheet && <><span>Character sheet</span><h2>{sheet.character_name}</h2><p>{sheet.race_name} · {sheet.class_name}</p><dl><dt>Gold</dt><dd>{sheet.gold}</dd><dt>XP</dt><dd>{sheet.xp}/{sheet.xp_needed}</dd><dt>Skills</dt><dd>{game.skills.map((skill) => skill.name).join(', ') || 'None'}</dd><dt>Inventory</dt><dd>{game.inventory.map((item) => item.name).join(', ') || 'Empty'}</dd></dl></>}
      </aside>

      <section className={styles.reader}>
        <header className={styles.chapter}>
          <span>{game?.currentDungeon?.name || 'Deep Saga'}</span>
          <h1>{game?.currentFloor?.floor_name || 'The Last Breath'}</h1>
          <p>Floor {game?.currentFloor?.floor_number || 1} · {game?.currentFloor?.story_purpose || 'The story begins.'}</p>
        </header>

        <div className={styles.story}>
          {!messages.length && !busy && <article className={styles.narration}><BookOpen /><p>{initialStory}</p></article>}
          {messages.map((message) => message.speaker === 'player' ? (
            <article className={styles.playerAction} key={message.id}><span>Player</span><p>{message.message_text}</p></article>
          ) : (
            <article className={styles.narration} key={message.id}><p>{message.message_text}</p></article>
          ))}
          <div ref={endRef} />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {busy && <p className={styles.loading}>The next page is being written...</p>}

        {!busy && !ended && (
          <section className={styles.actions}>
            {choices.length > 0 && <div className={styles.choiceList}>{choices.map((choice, index) => <button type="button" key={choice.id || `${choice.action}-${index}`} onClick={() => submit(choice.action || choice.text, 'suggested')}><small>{choice.direction || `Path ${index + 1}`}</small><strong>{choice.title || choice.text}</strong>{choice.text && choice.title && <span>{choice.text}</span>}</button>)}</div>}
            <form onSubmit={(event) => { event.preventDefault(); submit(action) }}>
              <label htmlFor="custom-action">Write your own action</label>
              <div><textarea id="custom-action" value={action} onChange={(event) => setAction(event.target.value)} placeholder="I keep my blade low and ask what wounded it..." rows="3" maxLength="1000" /><button type="submit" disabled={!action.trim()} title="Submit action"><ArrowUp /></button></div>
            </form>
          </section>
        )}
        {ended && <Link className={styles.returnLink} to="/library">Return to your stories</Link>}
      </section>
    </main>
  )
}
