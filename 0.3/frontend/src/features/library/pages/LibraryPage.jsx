import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Play } from 'lucide-react'
import { createRun, fetchLibrary } from '../../../api/deepSagaApi'
import { Shell } from '../../shell/Shell'

function latestRunForBook(runs, slug) {
  return runs
    .filter((run) => run.book?.slug === slug)
    .sort((a, b) => Number(b.runId) - Number(a.runId))
    .find((run) => run.status === 'active') || runs.find((run) => run.book?.slug === slug)
}

export function LibraryPage() {
  const navigate = useNavigate()
  const [state, setState] = useState({ books: [], runs: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLibrary()
      .then((payload) => setState(payload.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  async function begin(slug) {
    setBusy(true)
    setError('')
    try {
      const payload = await createRun(slug)
      navigate(`/play/${payload.data.run.runId}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <section className="page">
        <div className="hero-panel">
          <div className="stack">
            <p className="eyebrow">Library</p>
            <h1>DEEP SAGA</h1>
            <p>Choose a book, begin a run, and act freely. The Game Master narrates; the Story Guide protects canon; the engine decides what becomes real.</p>
          </div>
          <div className="book-cover" aria-hidden="true" />
        </div>

        {error && <p className="notice">{error}</p>}
        {loading ? <p>Loading library...</p> : (
          <div className="book-grid">
            {state.books.map((book) => {
              const run = latestRunForBook(state.runs, book.slug)
              return (
                <article className="book-card" key={book.slug}>
                  <div className={`mini-cover cover-${book.slug}`} aria-hidden="true" />
                  <div className="stack">
                    <p className="meta">Book {book.bookNumber} · {book.world}</p>
                    <h2>{book.title}</h2>
                    <p>{book.description}</p>
                    <div className="row">
                      <Link className="ghost-button" to={`/books/${book.slug}`}><BookOpen size={17} /> Details</Link>
                      {run?.status === 'active' ? (
                        <Link className="button" to={`/play/${run.runId}`}><Play size={17} /> Continue</Link>
                      ) : (
                        <button className="button" disabled={busy} onClick={() => begin(book.slug)}><Play size={17} /> Begin Story</button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </Shell>
  )
}
