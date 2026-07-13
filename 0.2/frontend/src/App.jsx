import { useEffect, useMemo, useState } from 'react'
import heroImg from './assets/hero.png'
import { createOpeningScene, fetchCurrentPlayer, loginPlayer, registerPlayer } from './api/authApi'
import { setStoredToken, getStoredToken } from './api/httpClient'
import { PortalLines } from './components/PortalLines/PortalLines'
import './App.css'

const raceExamples = ['Slime', 'Spider', 'Goblin', 'Kobold', 'Wolf', 'Skeleton', 'Bat', 'Mimic Larva']

const gameRules = [
  'Five dungeons, three floors each, with a boss guarding every third floor.',
  'Death before the fifth dungeon means a fresh monster body and only memories remain.',
  'Clearing the final boss starts a new cycle shaped by what the player believes they are.',
  'Every completed run leaves a stronger previous self as the next final boss.',
]

function App() {
  const [mode, setMode] = useState('register')
  const [form, setForm] = useState({ email: '', identifier: '', password: '' })
  const [player, setPlayer] = useState(null)
  const [scene, setScene] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [narrating, setNarrating] = useState(false)

  const body = player?.currentBody
  const choices = useMemo(() => {
    const race = body?.race || 'monster'

    return [
      `Study the ${race} body and test its first instinct.`,
      'Search the current floor for a hidden route or clue.',
      'Hunt a weaker enemy to gain experience and materials.',
      'Avoid combat and listen for the dungeon boss path.',
    ]
  }, [body])

  useEffect(() => {
    let ignore = false

    async function restore() {
      if (!getStoredToken()) return

      try {
        const payload = await fetchCurrentPlayer()
        if (!ignore) setPlayer(payload.data.player)
      } catch {
        setStoredToken(null)
      }
    }

    restore()
    return () => {
      ignore = true
    }
  }, [])

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const payload = mode === 'register'
        ? await registerPlayer({ email: form.email, password: form.password })
        : await loginPlayer({ identifier: form.identifier, password: form.password })

      setStoredToken(payload.data.token)
      setPlayer(payload.data.player)
      setScene(null)
      setMessage(payload.message)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    setStoredToken(null)
    setPlayer(null)
    setScene(null)
    setMessage('')
    setForm((current) => ({ ...current, password: '' }))
  }

  async function narrateOpening() {
    setNarrating(true)
    setMessage('')

    try {
      const payload = await createOpeningScene()
      setScene(payload.data)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setNarrating(false)
    }
  }

  return (
    <main className="appShell">
      <PortalLines />
      <section className="heroPane" aria-label="Deep Saga introduction">
        <img src={heroImg} alt="" className="heroImage" />
        <div className="heroShade" />
        <div className="heroCopy">
          <span className="eyebrow">Deep S3GA</span>
          <h1>Deep Saga</h1>
          <p>
            A choice-based isekai story RPG where death starts a new monster life,
            memories survive reincarnation, and every cleared run becomes a future final boss.
          </p>
          <div className="raceStrip" aria-label="Possible starting monster races">
            {raceExamples.map((race) => <span key={race}>{race}</span>)}
          </div>
        </div>
      </section>

      <section className="controlPane" aria-label="Player access">
        {player ? (
          <article className="sessionPanel">
            <div className="panelHead">
              <span>Player record</span>
              <button type="button" onClick={logout}>Log out</button>
            </div>
            <h2>{player.playerId}</h2>
            <p className="subtle">{player.email}</p>

            <div className="bodyGrid">
              <div>
                <span>Current body</span>
                <strong>{body?.race || 'Unknown'}</strong>
              </div>
              <div>
                <span>Run</span>
                <strong>{player.currentRun}</strong>
              </div>
              <div>
                <span>Dungeon</span>
                <strong>{body?.dungeon || 1}-F{body?.floor || 1}</strong>
              </div>
              <div>
                <span>Clears</span>
                <strong>{player.cycleClears}</strong>
              </div>
            </div>

            {body && (
              <div className="monsterSheet">
                <h3>{body.race} instincts</h3>
                <p><strong>Strengths:</strong> {body.strengths?.join(', ')}</p>
                <p><strong>Weaknesses:</strong> {body.weaknesses?.join(', ')}</p>
                <p><strong>Skills:</strong> {body.skills?.join(', ')}</p>
                <p><strong>Evolution:</strong> {body.evolutionPaths?.join(', ')}</p>
              </div>
            )}

            <div className="choicePanel">
              <div className="choiceHead">
                <h3>{scene ? 'Narrator scene' : 'Next four choices'}</h3>
                <button type="button" className="narrateButton" onClick={narrateOpening} disabled={narrating}>
                  {narrating ? 'Writing...' : 'AI narrate'}
                </button>
              </div>
              {scene?.narration && <p className="narration">{scene.narration}</p>}
              {(scene?.choices || choices).map((choice) => <button type="button" key={choice}>{choice}</button>)}
            </div>

            {message && <p className="notice">{message}</p>}
          </article>
        ) : (
          <form className="authPanel" onSubmit={submit}>
            <div className="tabs" role="tablist" aria-label="Authentication mode">
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
            </div>

            <div className="formHead">
              <span>{mode === 'register' ? 'First reincarnation' : 'Soul return'}</span>
              <h2>{mode === 'register' ? 'Create your player record' : 'Resume your dungeon cycle'}</h2>
            </div>

            {mode === 'register' ? (
              <label>
                <span>Email</span>
                <input name="email" type="email" value={form.email} onChange={update} required autoComplete="email" />
              </label>
            ) : (
              <label>
                <span>Email or Player ID</span>
                <input name="identifier" value={form.identifier} onChange={update} required autoComplete="username" placeholder="you@example.com or DS-XXXXXXXXXX" />
              </label>
            )}

            <label>
              <span>Password</span>
              <input name="password" type="password" minLength="8" value={form.password} onChange={update} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            </label>

            <button className="submitButton" disabled={busy}>
              {busy ? 'Opening record...' : mode === 'register' ? 'Begin as a monster' : 'Enter Deep Saga'}
            </button>

            {message && <p className="notice" role="alert">{message}</p>}

            <div className="rules">
              {gameRules.map((rule) => <p key={rule}>{rule}</p>)}
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

export default App
