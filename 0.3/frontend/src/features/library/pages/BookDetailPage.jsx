import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Play, RotateCcw } from 'lucide-react'
import { createRun, fetchBook } from '../../../api/deepSagaApi'
import { Shell } from '../../shell/Shell'

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
              <p>Beginning state: Ant larva, level 1, human memories retained, alone in the Ant Nursery. No future truth is granted up front.</p>
              <div className="row">
                {active && <Link className="button" to={`/play/${active.runId}`}><Play size={17} /> Continue</Link>}
                <button className={active ? 'ghost-button' : 'button'} disabled={busy} onClick={begin}>
                  {active ? <RotateCcw size={17} /> : <Play size={17} />}
                  {active ? 'New Story' : 'Begin'}
                </button>
              </div>
            </div>
            <div className="book-cover" aria-hidden="true" />
          </div>
        )}
      </section>
    </Shell>
  )
}
