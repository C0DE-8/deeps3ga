import { useEffect, useState } from 'react'
import { fetchDeepSagaFlow } from '../../../../api/deepSagaApi'
import { PhaseFlow } from '../../components/PhaseFlow/PhaseFlow'
import styles from './DeepSagaSetup.module.css'

const fallbackFlow = {
  name: 'Deep Saga',
  premise: 'A dark fantasy story told through chat, where every message is the next page.',
  backendOrder: [
    'auth router for accounts',
    'database config from .env',
    'soul router for reincarnation memory',
    'story router for narrator messages',
    '10 dungeons with 5 floors each',
    'boss floor progression',
    'legacy guardian from the previous completed story',
  ],
  frontendOrder: [
    'axios API client',
    'feature folders',
    'module CSS per component',
    'novel-like story page',
    'choice buttons at story pauses',
    'free action input',
    'soul and dungeon progress panels',
  ],
  phases: [
    { phase: 1, title: 'Death', summary: 'The player dies in the real world and experiences the opening without choosing it.' },
    { phase: 2, title: 'Awakening', summary: 'The player wakes in Deep Saga inside a random avatar with no world knowledge.' },
    { phase: 3, title: 'The Story Begins', summary: 'The Narrator tells the adventure like a novel with dialogue, thought, and reaction.' },
    { phase: 4, title: 'Choices', summary: 'At important moments, the player picks a choice or types their own action.' },
    { phase: 5, title: 'Exploration', summary: 'The story moves through 10 Dungeons with 5 floors each; every 5th floor is a boss.' },
    { phase: 6, title: 'Growth', summary: 'People, secrets, abilities, and consequences reshape the journey.' },
    { phase: 7, title: 'Death', summary: 'Death ends that body and starts a new story with soul memory intact.' },
    { phase: 8, title: 'The End of the Cycle', summary: 'Completing all 10 Dungeons makes that character part of history.' },
    { phase: 9, title: 'A New Legend', summary: 'The next final enemy is the previous completed hero, fighting as they once did.' },
  ],
}

export function DeepSagaSetup() {
  const [flow, setFlow] = useState(fallbackFlow)
  const [status, setStatus] = useState('Using local setup flow until the backend is running.')

  useEffect(() => {
    let active = true

    fetchDeepSagaFlow()
      .then((data) => {
        if (!active) return
        setFlow(data)
        setStatus('Backend flow loaded through axios.')
      })
      .catch(() => {
        if (!active) return
        setStatus('Backend not connected yet. Local setup flow is shown.')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Backend first, frontend second</p>
          <h1>{flow.name}</h1>
          <p>{flow.premise}</p>
        </div>
        <aside className={styles.status}>{status}</aside>
      </header>

      <section className={styles.columns}>
        <div>
          <h2>Backend Setup</h2>
          <ul>
            {flow.backendOrder.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Frontend Setup</h2>
          <ul>
            {flow.frontendOrder.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <PhaseFlow phases={flow.phases} />
    </main>
  )
}
