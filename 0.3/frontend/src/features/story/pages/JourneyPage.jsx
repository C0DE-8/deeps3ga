import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchJourney } from '../../../api/deepSagaApi'
import { Shell } from '../../shell/Shell'

export function JourneyPage() {
  const { runId } = useParams()
  const [journey, setJourney] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchJourney(runId)
      .then((payload) => setJourney(payload.data))
      .catch((requestError) => setError(requestError.message))
  }, [runId])

  return (
    <Shell>
      <section className="page">
        {error && <p className="notice">{error}</p>}
        {journey && (
          <div className="stack">
            <p className="eyebrow">{journey.book.title}</p>
            <h1>Journey</h1>
            <p>Status: {journey.run.status}. Chapter {journey.run.currentChapter}. Stage: {journey.character.lifeStage}. Level {journey.character.level}.</p>
            <div className="row">
              <Link className="button" to="/library">Library</Link>
              {journey.run.status === 'active' && <Link className="ghost-button" to={`/play/${runId}`}>Continue</Link>}
            </div>
            <section className="panel">
              <h2>Known Discoveries</h2>
              {journey.discoveries.map((item) => <p key={item.key}><strong>{item.title}</strong><br />{item.content}</p>)}
            </section>
            <section className="panel">
              <h2>Story Record</h2>
              {journey.messages.map((message) => (
                <div className={`message ${message.role}`} key={message.id || `${message.role}-${message.turnNumber}`}>
                  <p className="meta">{message.role === 'gm' ? 'Game Master' : 'Player'}</p>
                  <div className="narration">{message.content}</div>
                </div>
              ))}
            </section>
          </div>
        )}
      </section>
    </Shell>
  )
}
