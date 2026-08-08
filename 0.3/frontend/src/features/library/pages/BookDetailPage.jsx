import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Play, RotateCcw } from 'lucide-react'
import { createRun, fetchBook } from '../../../api/deepSagaApi'
import { Shell } from '../../shell/Shell'

function startText(book) {
  return book?.coverConfig?.startText || (book?.slug === 'ant-world'
    ? 'Ant larva, level 1, human memories retained, alone in the Ant Nursery. No future truth is granted up front.'
    : 'A new body, level 1, memory intact, and the first danger already close.')
}

export function BookDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [runs, setRuns] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchBook(slug)
      .then((payload) => {
        setBook(payload.data.book)
        setRuns(payload.data.runs)
      })
      .catch((requestError) => setError(requestError.message))
  }, [slug])

  async function begin() {
    setBusy(true)
    try {
      const payload = await createRun(slug)
      navigate(`/play/${payload.data.run.runId}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const active = runs.find((run) => run.status === 'active')
  const recentRuns = [...runs].sort((a, b) => Number(b.runId) - Number(a.runId)).slice(0, 4)

  return (
    <Shell>
      <section className="page">
        {error && <p className="notice">{error}</p>}
        {book && (
          <div className="hero-panel">
            <div className="stack">
              <p className="eyebrow">Book {book.bookNumber} · {book.world}</p>
              <h1>{book.title}</h1>
              <p>{book.description}</p>
              <p>Beginning state: {startText(book)}</p>
              <div className="row">
                {active && <Link className="button" to={`/play/${active.runId}`}><Play size={17} /> Continue</Link>}
                <button className={active ? 'ghost-button' : 'button'} disabled={busy} onClick={begin}>
                  {active ? <RotateCcw size={17} /> : <Play size={17} />}
                  {active ? 'Start New Run' : 'Begin'}
                </button>
              </div>
              {recentRuns.length > 0 && (
                <div className="run-list">
                  <p className="meta">Your runs</p>
                  {recentRuns.map((run) => (
                    <Link key={run.runId} to={`/play/${run.runId}`}>
                      <span>{run.status === 'active' ? 'Continue' : run.status}</span>
                      <strong>Run {run.runId}</strong>
                      <small>Chapter {run.currentChapter} · {run.storyBeat.replace(/[-_]/g, ' ')}</small>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className={`book-cover cover-${book.slug}`} aria-hidden="true" />
          </div>
        )}
      </section>
    </Shell>
  )
}
