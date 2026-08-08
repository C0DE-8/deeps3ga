import { useCallback, useEffect, useMemo, useState } from 'react'
/* eslint-disable react-hooks/set-state-in-effect */
import { Link, useParams } from 'react-router-dom'
import { BookMarked, HeartPulse, MapPin, Send, Skull, Sparkles, Target, Users } from 'lucide-react'
import { fetchJournal, fetchRun, sendRunAction } from '../../../api/deepSagaApi'
import { Shell } from '../../shell/Shell'

function actionId() {
  return `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`
}

function latestChoices(messages) {
  const latestGm = [...messages].reverse().find((message) => message.role === 'gm')
  const guided = latestGm?.metadata?.guidedChoice
  const choices = [...(guided ? [guided] : []), ...(latestGm?.metadata?.suggestedChoices || [])]
  const seen = new Set()
  return choices.filter((choice) => {
    const key = `${choice?.label || ''}::${choice?.action || ''}`.toLowerCase()
    if (!choice?.label || !choice?.action || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 4)
}

function chapterEmoji(chapterNumber) {
  if (chapterNumber >= 13) return '🧬'
  if (chapterNumber >= 11) return '⚔️'
  if (chapterNumber >= 8) return '🏆'
  if (chapterNumber >= 6) return '🌎'
  if (chapterNumber >= 2) return '👑'
  return '🐜'
}

function eventTypeLabel(type = 'STORY_EVENT') {
  return String(type).replace(/_/g, ' ')
}

function percent(current = 0, max = 1) {
  if (!max) return 0
  return Math.max(0, Math.min(100, Math.round((Number(current || 0) / Number(max)) * 100)))
}

function formatBeat(value = '') {
  return String(value || 'unknown').replace(/[-_]/g, ' ')
}

function StoryText({ content }) {
  return (
    <div className="story-text">
      {String(content || '').split(/\n{2,}/).filter(Boolean).map((paragraph, index) => {
        const eventMatch = paragraph.match(/^\[(DISCOVERY|TRAIT EMERGING|EVOLUTION AVAILABLE|WARNING|SYSTEM|LEVEL INCREASED)\]\s*(.*)$/i)
        if (eventMatch) {
          return (
            <aside className="system-event inline-event" key={`${paragraph}-${index}`}>
              <span>✨ {eventMatch[1]}</span>
              <strong>{eventMatch[2] || 'Something changes.'}</strong>
            </aside>
          )
        }
        return <p className="narration-paragraph" key={`${paragraph}-${index}`}>{paragraph}</p>
      })}
    </div>
  )
}

function StoryHeader({ bundle }) {
  const chapter = bundle.chapter || {}
  const run = bundle.run || {}
  const character = bundle.character || {}

  return (
    <header className="reader-header">
      <div className="chapter-kicker">
        <span>{chapterEmoji(chapter.chapterNumber)} Chapter {chapter.chapterNumber}</span>
        <span>{bundle.book?.world}</span>
      </div>
      <h1>{chapter.title}</h1>
      {chapter.purpose && <p>{chapter.purpose}</p>}
      <div className="story-state-strip" aria-label="Current story state">
        <span><MapPin size={15} /> {character.location || 'Unknown location'}</span>
        <span><Target size={15} /> {formatBeat(run.storyBeat)}</span>
        <span><Sparkles size={15} /> Turn {run.turnVersion}</span>
      </div>
    </header>
  )
}

function SystemEvents({ events = [] }) {
  if (!events.length) return null
  return (
    <div className="system-events">
      {events.slice(0, 3).map((event, index) => (
        <aside className="system-event" key={`${event.type || 'event'}-${event.title || index}`}>
          <span>{event.emoji || '✨'} {eventTypeLabel(event.type)}</span>
          <strong>{event.title}</strong>
          {event.body && <p>{event.body}</p>}
        </aside>
      ))}
    </div>
  )
}

function Meter({ label, value, max, tone = 'gold' }) {
  const fill = percent(value, max)
  return (
    <div className={`meter meter-${tone}`}>
      <div className="meter-label">
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>
      <div className="meter-track"><span style={{ width: `${fill}%` }} /></div>
    </div>
  )
}

function StatusScreen({ run }) {
  const dead = run.status === 'dead'
  return (
    <section className="death-screen page">
      <div className="stack">
        {dead && <Skull size={42} style={{ margin: '0 auto' }} />}
        <p className="eyebrow">{dead ? 'Run ended' : 'Book complete'}</p>
        <h1>{dead ? 'Death Is Real' : run.endingTitle || 'The Last Ant'}</h1>
        <p>{dead ? run.deathReason || 'This character died, and the run cannot continue.' : run.endingSummary}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="button" to="/library">Return to Library</Link>
          <Link className="ghost-button" to={`/journey/${run.runId}`}>View Journey</Link>
        </div>
      </div>
    </section>
  )
}

function JournalPanel({ runId, journal, onRefresh }) {
  const character = journal?.character || {}
  const discoveries = journal?.discoveries || []
  const relationships = journal?.relationships || []
  const events = journal?.events || []
  const threads = journal?.openThreads || []

  return (
    <aside className="side-panel">
      <section className="panel">
        <div className="row">
          <BookMarked size={18} />
          <h3>Character</h3>
        </div>
        <dl>
          <div><dt>Species</dt><dd>{character.species || 'Ant'}</dd></div>
          <div><dt>Stage</dt><dd>{character.lifeStage || 'Larva'}</dd></div>
          <div><dt>Level</dt><dd>{character.level || 1}</dd></div>
          <div><dt>Condition</dt><dd>{character.conditionText || 'Unknown'}</dd></div>
        </dl>
        <div className="meter-stack">
          <Meter label="Health" value={character.healthCurrent ?? 0} max={character.healthMax ?? 1} tone="red" />
          <Meter label="Experience" value={character.experience ?? 0} max={character.experienceToNext ?? 1} />
          {character.manaKnown && <Meter label="Mana" value={character.manaCurrent ?? 0} max={character.manaMax ?? 1} tone="blue" />}
        </div>
      </section>
      <section className="panel">
        <div className="row">
          <Sparkles size={18} />
          <h3>Discoveries</h3>
        </div>
        {discoveries.length ? discoveries.slice(-4).map((item) => (
          <p key={item.key}><strong>{item.title}</strong><br />{item.content}</p>
        )) : <p>No new discoveries yet.</p>}
      </section>
      <section className="panel">
        <div className="row">
          <Users size={18} />
          <h3>Relations</h3>
        </div>
        {relationships.length ? relationships.slice(0, 4).map((item) => (
          <p key={item.targetKey}><strong>{item.displayName}</strong><br />Trust {item.trust} · Fear {item.fear} · Respect {item.respect}</p>
        )) : <p>No relationships are clear yet.</p>}
      </section>
      <section className="panel">
        <div className="row">
          <HeartPulse size={18} />
          <h3>Story Pulse</h3>
        </div>
        {events.length ? events.slice(0, 3).map((item) => (
          <p key={item.key}><strong>{item.title}</strong><br />{item.content}</p>
        )) : <p>No major event has settled yet.</p>}
      </section>
      <section className="panel">
        <h3>Objectives</h3>
        {threads.length ? threads.map((item) => <p key={item.key}><strong>{item.title}</strong><br />{item.content}</p>) : <p>No formal objective has settled yet.</p>}
        <button className="ghost-button" onClick={() => onRefresh(runId)}>Refresh Journal</button>
      </section>
    </aside>
  )
}

export function StoryPage() {
  const { runId } = useParams()
  const [bundle, setBundle] = useState(null)
  const [journal, setJournal] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const payload = await fetchRun(runId)
    setBundle(payload.data)
    const journalPayload = await fetchJournal(runId)
    setJournal(journalPayload.data)
  }, [runId])

  useEffect(() => {
    load().catch((requestError) => setError(requestError.message))
  }, [load])

  const choices = useMemo(() => latestChoices(bundle?.messages || []), [bundle])

  async function submit(actionText = draft) {
    const action = actionText.trim()
    if (!action || busy || bundle?.run?.status !== 'active') return
    setBusy(true)
    setError('')
    try {
      const payload = await sendRunAction(runId, {
        action,
        clientActionId: actionId(),
        expectedVersion: bundle.run.turnVersion,
      })
      setBundle(payload.data)
      const journalPayload = await fetchJournal(runId)
      setJournal(journalPayload.data)
      setDraft('')
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.status === 409) {
        fetchRun(runId).then((payload) => setBundle(payload.data)).catch(() => {})
      }
    } finally {
      setBusy(false)
    }
  }

  if (!bundle) {
    return <Shell><section className="page"><p>Opening the run...</p>{error && <p className="notice">{error}</p>}</section></Shell>
  }

  if (bundle.run.status !== 'active') {
    return <Shell><StatusScreen run={bundle.run} /></Shell>
  }

  return (
    <Shell>
      <section className="page reader-layout">
        <div>
          <article className="reader">
            <StoryHeader bundle={bundle} />
            {(bundle.messages || []).map((message) => (
              <section className={`message ${message.role}`} key={message.id || `${message.role}-${message.turnNumber}`}>
                <p className="message-label">{message.role === 'player' ? 'You attempted' : 'Game Master'}</p>
                <div className="narration"><StoryText content={message.content} /></div>
                {message.role === 'gm' && <SystemEvents events={message.metadata?.systemEvents || []} />}
              </section>
            ))}
          </article>

          <section className="composer">
            {choices.length > 0 && (
              <div className="suggested-action">
                <p>🐜 Suggested actions</p>
                {choices.map((choice) => (
                  <button key={choice.action || choice.label} disabled={busy} onClick={() => submit(choice.action || choice.label)}>
                    <strong>{choice.label}</strong>
                    {choice.action && choice.action !== choice.label && <span>{choice.action}</span>}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="notice">{error}</p>}
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What do you do?" disabled={busy} />
            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <span className="meta">{busy ? 'The world shifts...' : 'Free action is always available'}</span>
              <button className="button" disabled={busy || !draft.trim()} onClick={() => submit()}>
                <Send size={17} /> Act
              </button>
            </div>
          </section>
        </div>

        <JournalPanel runId={runId} journal={journal} onRefresh={() => fetchJournal(runId).then((payload) => setJournal(payload.data))} />
      </section>
    </Shell>
  )
}
