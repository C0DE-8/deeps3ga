import { useEffect, useRef, useState } from 'react'
import { ChevronDown, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { continueNarrative, fetchGameState } from '../../../../api/deepSagaApi'
import { AppHeader } from '../../../shell/AppHeader/AppHeader'
import { CharacterSheet } from '../../components/CharacterSheet/CharacterSheet'
import { ChoiceComposer } from '../../components/ChoiceComposer/ChoiceComposer'
import { StatusBar } from '../../components/StatusBar/StatusBar'
import { StoryPanel } from '../../components/StoryPanel/StoryPanel'
import { openingScenes } from '../../data/openingStory'
import styles from './StorySimulation.module.css'

function characterFromState(state) {
  const sheet = state.characterSheet
  return {
    name: sheet.character_name,
    race: sheet.race_name,
    className: sheet.class_name,
    stats: Object.entries(sheet.stats_json || {}),
    skills: state.skills.map((skill) => `${skill.name} · ${skill.skill_level}`),
    inventory: state.inventory.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`),
    titles: sheet.titles_json || [],
  }
}

function sceneFromNarrator(result, index, state, action) {
  const scene = result.scene || result
  const story = scene.story || 'The Dungeon waits, listening for what you will do next.'
  return {
    id: `narrative-${result.saved?.narrativeMessageId || index}`,
    chapter: state.currentDungeon?.name || 'Deep Saga',
    title: state.currentFloor?.floor_name || 'The next page',
    playerAction: action,
    paragraphs: story.split(/\n\s*\n/).filter(Boolean),
    choices: scene.choices || [],
    status: {
      hp: state.characterSheet.hp,
      mp: state.characterSheet.mana,
      level: state.characterSheet.level,
      dungeon: state.currentDungeon?.name,
      floor: `Floor ${state.currentFloor?.floor_number}`,
    },
  }
}

export function StorySimulation() {
  const { cycleId } = useParams()
  const [state, setState] = useState(null)
  const [scenes, setScenes] = useState([openingScenes[0]])
  const [customAction, setCustomAction] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => { fetchGameState(cycleId).then(setState).catch((e) => setError(e.response?.data?.message || 'This story could not be opened.')).finally(() => setBusy(false)) }, [cycleId])
  useEffect(() => { if (scenes.length > 1) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [scenes.length])

  async function submitAction(action, actionKind = 'typed') {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await continueNarrative({ storyCycleId: Number(cycleId), playerAction: action, actionKind })
      setScenes((current) => [...current, sceneFromNarrator(result, current.length, state, action)])
      setCustomAction('')
      setState(await fetchGameState(cycleId))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The narrator fell silent. Try this action again.')
    } finally { setBusy(false) }
  }

  const latest = scenes.at(-1)
  const status = state ? { hp: state.characterSheet.hp, mp: state.characterSheet.mana, level: state.characterSheet.level, dungeon: state.currentDungeon.name, floor: `Floor ${state.currentFloor.floor_number}` } : latest.status
  return (
    <main className={styles.reader}>
      <AppHeader compact />
      <StatusBar status={status} />
      <button className={styles.sheetToggle} type="button" onClick={() => setSheetOpen((open) => !open)} title={sheetOpen ? 'Close character sheet' : 'Open character sheet'}>{sheetOpen ? <PanelRightClose /> : <PanelRightOpen />}</button>
      <aside className={`${styles.sheetDrawer} ${sheetOpen ? styles.open : ''}`}>{state && <CharacterSheet character={characterFromState(state)} />}</aside>
      <div className={styles.storyStream}>
        {scenes.map((scene, index) => <div className={styles.sceneWrap} key={scene.id} ref={index === scenes.length - 1 ? endRef : null}><StoryPanel scene={scene} />{index < scenes.length - 1 && <ChevronDown className={styles.pageBreak} size={20} />}</div>)}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.currentChoice}>
          {busy && scenes.length === 1 && <p className={styles.loading}>The record is opening...</p>}
          <ChoiceComposer choices={latest.choices || []} customAction={customAction} onCustomActionChange={setCustomAction} onSubmitAction={submitAction} disabled={busy} />
        </div>
      </div>
    </main>
  )
}
