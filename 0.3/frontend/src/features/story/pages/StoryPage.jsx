import { useCallback, useEffect, useMemo, useState } from 'react'
/* eslint-disable react-hooks/set-state-in-effect */
import { Link, useParams } from 'react-router-dom'
import { BookMarked, Send, Skull } from 'lucide-react'
import { fetchJournal, fetchRun, sendRunAction } from '../../../api/deepSagaApi'
import { Shell } from '../../shell/Shell'

function actionId() {
  return `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`
}

function latestChoices(messages) {
  const latestGm = [...messages].reverse().find((message) => message.role === 'gm')
  const guided = latestGm?.metadata?.guidedChoice
  const choices = guided ? [guided] : latestGm?.metadata?.suggestedChoices || []
  return choices.slice(0, 1)
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
  return (
    <aside className="side-panel">
      <section className="panel">
        <div className="row">
          <BookMarked size={18} />
          <h3>Character</h3>
        </div>
        <dl>
          <div><dt>Species</dt><dd>{journal?.character?.species || 'Ant'}</dd></div>
          <div><dt>Stage</dt><dd>{journal?.character?.lifeStage || 'Larva'}</dd></div>
          <div><dt>Level</dt><dd>{journal?.character?.level || 1}</dd></div>
          <div><dt>Condition</dt><dd>{journal?.character?.conditionText || 'Unknown'}</dd></div>
          {journal?.character?.manaKnown && <div><dt>Mana</dt><dd>{journal.character.manaCurrent}/{journal.character.manaMax}</dd></div>}
        </dl>
      </section>
      <section className="panel">
        <h3>Discoveries</h3>
        {(journal?.discoveries || []).slice(-5).map((item) => <p key={item.key}><strong>{item.title}</strong><br />{item.content}</p>)}
      </section>
      <section className="panel">
        <h3>Objectives</h3>
        {(journal?.openThreads || []).length ? journal.openThreads.map((item) => <p key={item.key}>{item.title}</p>) : <p>No formal objective has settled yet.</p>}
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
            <p className="eyebrow">{chapterEmoji(bundle.chapter.chapterNumber)} Chapter {bundle.chapter.chapterNumber}</p>
            <h1>{bundle.chapter.title}</h1>
            {(bundle.messages || []).map((message) => (
              <section className={`message ${message.role}`} key={message.id || `${message.role}-${message.turnNumber}`}>
                {message.role === 'player' && <p className="meta">You attempted</p>}
                <div className="narration"><StoryText content={message.content} /></div>
                {message.role === 'gm' && <SystemEvents events={message.metadata?.systemEvents || []} />}
              </section>
            ))}
          </article>

          <section className="composer">
            {choices.length > 0 && (
              <div className="suggested-action">
                <p>🐜 Suggested action</p>
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
              <span className="meta">{busy ? 'The world shifts...' : '✍️ Your action'}</span>
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
