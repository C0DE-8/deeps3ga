import { useMemo, useState } from 'react'
import { CharacterSheet } from '../../components/CharacterSheet/CharacterSheet'
import { ChoiceComposer } from '../../components/ChoiceComposer/ChoiceComposer'
import { StatusBar } from '../../components/StatusBar/StatusBar'
import { StoryPanel } from '../../components/StoryPanel/StoryPanel'
import { characterSheet, openingScenes } from '../../data/openingStory'
import styles from './StorySimulation.module.css'

export function StorySimulation() {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [customAction, setCustomAction] = useState('')
  const [history, setHistory] = useState([])

  const scene = openingScenes[sceneIndex]
  const nextScene = useMemo(() => Math.min(sceneIndex + 1, openingScenes.length - 1), [sceneIndex])

  function submitAction(action) {
    setHistory((current) => [...current, action].slice(-4))
    setCustomAction('')
    setSceneIndex(nextScene)
  }

  return (
    <main className={styles.reader}>
      <StatusBar status={scene.status} />
      <section className={styles.layout}>
        <div className={styles.storyColumn}>
          <StoryPanel scene={scene} />
          <ChoiceComposer
            choices={scene.choices}
            customAction={customAction}
            onCustomActionChange={setCustomAction}
            onSubmitAction={submitAction}
          />
        </div>
        <aside className={styles.sidePanel}>
          <CharacterSheet character={characterSheet} />
          <section className={styles.memoryPanel}>
            <h2>Soul Memory</h2>
            {history.length ? (
              <ol>
                {history.map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ol>
            ) : (
              <p>No remembered choices yet.</p>
            )}
          </section>
          <section className={styles.memoryPanel}>
            <h2>Dungeon Structure</h2>
            <p>10 Dungeons. 5 Floors each. Every 5th Floor is a Boss Floor.</p>
          </section>
        </aside>
      </section>
    </main>
  )
}
