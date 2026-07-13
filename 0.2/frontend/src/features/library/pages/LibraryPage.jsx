import { Link } from 'react-router-dom'
import { AppHeader } from '../../shell/AppHeader'
import { useAuth } from '../../auth/useAuth'

const dungeonPlan = [
  'Dungeon 1: The Buried Mouth',
  'Dungeon 2: Root-Cage Labyrinth',
  'Dungeon 3: Ashen Nest',
  'Dungeon 4: Mirror Crypt',
  'Dungeon 5: Throne Below Memory',
]

export function LibraryPage() {
  const { player } = useAuth()
  const body = player?.currentBody || {}

  return (
    <main className="libraryPage">
      <AppHeader />
      <section className="libraryHero">
        <p>Your soul archive</p>
        <h1>Every life leaves a page behind.</h1>
        <Link className="primaryButton linkButton" to="/read/current">Continue reading</Link>
      </section>

      <section className="libraryGrid">
        <article className="recordPanel">
          <header>
            <span>Active record</span>
            <strong>{player.playerId}</strong>
          </header>
          <div className="recordStats">
            <div><span>Body</span><strong>{body.race || 'Unknown'}</strong></div>
            <div><span>Run</span><strong>{player.currentRun}</strong></div>
            <div><span>Dungeon</span><strong>{body.dungeon || 1}</strong></div>
            <div><span>Floor</span><strong>{body.floor || 1}</strong></div>
          </div>
          <p className="recordCopy">
            You remember being human. Everything else must be earned again through choices,
            survival, discovery, evolution, and the bosses waiting every third floor.
          </p>
        </article>

        <article className="recordPanel">
          <header>
            <span>Current body</span>
            <strong>{body.status || 'newly reincarnated'}</strong>
          </header>
          <div className="traitList">
            <p><span>Strengths</span>{body.strengths?.join(', ') || 'Unrecorded'}</p>
            <p><span>Weaknesses</span>{body.weaknesses?.join(', ') || 'Unrecorded'}</p>
            <p><span>Skills</span>{body.skills?.join(', ') || 'Unrecorded'}</p>
            <p><span>Evolution</span>{body.evolutionPaths?.join(', ') || 'Unknown'}</p>
          </div>
        </article>

        <section className="dungeonShelf">
          <header>
            <span>World structure</span>
            <h2>Five dungeons, three floors each</h2>
          </header>
          <div className="dungeonList">
            {dungeonPlan.map((dungeon, index) => (
              <article key={dungeon} className={index + 1 === Number(body.dungeon || 1) ? 'current' : ''}>
                <span>Dungeon {index + 1}</span>
                <h3>{dungeon.split(': ')[1]}</h3>
                <p>Floors 1-2 test survival. Floor 3 holds the boss gate.</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
