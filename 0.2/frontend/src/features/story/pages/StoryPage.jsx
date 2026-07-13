import { useMemo, useState } from 'react'
import { createOpeningScene } from '../../../api/authApi'
import { useAuth } from '../../auth/useAuth'
import { AppHeader } from '../../shell/AppHeader'

export function StoryPage() {
  const { player } = useAuth()
  const [scene, setScene] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const body = player.currentBody || {}
  const fallbackChoices = useMemo(() => [
    `Study your ${body.race || 'monster'} body and test its instincts.`,
    'Search the chamber for a secret route or useful remains.',
    'Hunt a weaker enemy to earn your first level.',
    'Stay hidden and listen for the boss path below.',
  ], [body.race])
  const choices = scene?.choices || fallbackChoices

  async function narrate() {
    setBusy(true)
    setError('')

    try {
      const payload = await createOpeningScene()
      setScene(payload.data)
    } catch (requestError) {
      setError(requestError.message || 'The narrator fell silent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="storyPage">
      <AppHeader />
      <section className="readerHero">
        <span>Run {player.currentRun} · {body.race || 'Monster'} body</span>
        <h1>The first page opens in the dark.</h1>
        <button className="primaryButton" type="button" onClick={narrate} disabled={busy}>
          {busy ? 'Writing scene...' : scene ? 'Rewrite scene' : 'Ask AI narrator'}
        </button>
      </section>

      <section className="readerLayout">
        <article className="storyPanel">
          <span>Scene</span>
          <p>
            {scene?.narration || `You wake beneath black stone, no longer human. Your ${body.race || 'monster'} body answers before your memories do. Somewhere below, a boss waits on every third floor, and every choice decides whether this life becomes a record or a corpse.`}
          </p>
          {error && <p className="formError">{error}</p>}
        </article>

        <aside className="choiceStack">
          <span>Choose one path</span>
          {choices.map((choice, index) => (
            <button type="button" key={choice}>
              <strong>{index + 1}</strong>
              {choice}
            </button>
          ))}
        </aside>
      </section>
    </main>
  )
}
