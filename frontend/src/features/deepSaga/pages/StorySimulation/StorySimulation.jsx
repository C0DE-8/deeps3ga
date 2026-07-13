import { useEffect, useRef, useState } from 'react'
import { ChevronDown, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { continueNarrative, fetchGameState } from '../../../../api/deepSagaApi'
import { AppHeader } from '../../../shell/AppHeader/AppHeader'
import { CharacterSheet } from '../../components/CharacterSheet/CharacterSheet'
import { ChoiceComposer } from '../../components/ChoiceComposer/ChoiceComposer'
import { CombatTargets } from '../../components/CombatTargets/CombatTargets'
import { EngineResults } from '../../components/EngineResults/EngineResults'
import { StatusBar } from '../../components/StatusBar/StatusBar'
import { StoryPanel } from '../../components/StoryPanel/StoryPanel'
import { openingScenes } from '../../data/openingStory'
import styles from './StorySimulation.module.css'

function characterFromState(state) {
  const sheet = state.characterSheet
  return {
    name: sheet.character_name,
    species: sheet.species_name,
    race: sheet.race_name,
    className: sheet.class_name,
    level: sheet.level,
    xp: sheet.xp,
    xpNeeded: sheet.xp_needed,
    hp: sheet.hp,
    maxHp: sheet.max_hp,
    mana: sheet.mana,
    maxMana: sheet.max_mana,
    stamina: sheet.stamina,
    maxStamina: sheet.max_stamina,
    health: sheet.health_condition,
    gold: sheet.gold,
    soulEnergy: state.run.soul_energy,
    soulId: state.run.soul_profile_id,
    characterId: state.run.character_life_id,
    lifeNumber: state.run.life_number,
    stats: [
      ['Strength', sheet.strength],
      ['Agility', sheet.agility],
      ['Defense', sheet.defense],
      ['Thaumaturgy', sheet.thaumaturgy],
      ['Resolve', sheet.resolve_stat],
      ['Intelligence', sheet.intelligence],
      ['Luck', sheet.luck],
      ['Charisma', sheet.charisma],
    ],
    skills: state.skills.map((skill) => `${skill.name} Lv.${skill.skill_level} · ${skill.skill_xp}/${skill.xp_needed} XP${skill.equipped ? ' · Equipped' : ''}`),
    inventory: state.inventory.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`),
    titles: sheet.titles_json || [],
    traits: [...(sheet.traits_json || []).map((trait) => trait.name || String(trait)), ...state.traits.map((trait) => trait.name)],
    statuses: state.statusEffects.map((status) => `${status.name}${status.remaining_turns === null ? '' : ` · ${status.remaining_turns} turns`}`),
    injuries: state.injuries.map((injury) => `${injury.name} · ${injury.severity}`),
    companions: state.companions.map((companion) => `${companion.name} · ${companion.companion_status} · Trust ${companion.trust} · Loyalty ${companion.loyalty}`),
    equipment: state.equipment.map((entry) => {
      const item = state.inventory.find((candidate) => candidate.inventory_id === entry.inventory_id)
      return `${item?.name || entry.equipped_slot} · ${entry.durability}/${entry.max_durability}`
    }),
    familyMastery: state.familyMastery.map((family) => `${family.name} · Mastery ${family.mastery_level} · ${family.mastery_xp} XP`),
    evolutions: state.evolutionChoices.map((choice) => `${choice.source_name} → ${choice.option_name}`),
    ultimateTrials: state.ultimateTrials.map((trial) => `${trial.skill_name} · ${trial.status} · ${trial.progress}/${trial.required_progress}`),
    memories: state.storyMemory.map((memory) => memory.summary),
    position: {
      dungeon: state.currentDungeon.name,
      floor: state.currentFloor.floor_number,
      chapter: state.run.current_chapter,
      scene: state.run.current_scene,
    },
    lifeHistory: state.lifeHistory,
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
    engineResolution: result.engineResolution || null,
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
      if (!result.engineResolution?.died && !result.engineResolution?.runCompleted) {
        setState(await fetchGameState(cycleId))
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The narrator fell silent. Try this action again.')
    } finally { setBusy(false) }
  }

  const latest = scenes.at(-1)
  const storyEnded = latest.engineResolution?.died || latest.engineResolution?.runCompleted
  const status = state ? { hp: state.characterSheet.hp, mp: state.characterSheet.mana, level: state.characterSheet.level, dungeon: state.currentDungeon.name, floor: `Floor ${state.currentFloor.floor_number}` } : latest.status
  return (
    <main className={styles.reader}>
      <AppHeader compact />
      <StatusBar status={status} />
      <button className={styles.sheetToggle} type="button" onClick={() => setSheetOpen((open) => !open)} title={sheetOpen ? 'Close character sheet' : 'Open character sheet'}>{sheetOpen ? <PanelRightClose /> : <PanelRightOpen />}</button>
      <aside className={`${styles.sheetDrawer} ${sheetOpen ? styles.open : ''}`}>{state && <CharacterSheet character={characterFromState(state)} />}</aside>
      <div className={styles.storyStream}>
        {scenes.map((scene, index) => <div className={styles.sceneWrap} key={scene.id} ref={index === scenes.length - 1 ? endRef : null}><StoryPanel scene={scene} /><EngineResults resolution={scene.engineResolution} />{index < scenes.length - 1 && <ChevronDown className={styles.pageBreak} size={20} />}</div>)}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.currentChoice}>
          {busy && scenes.length === 1 && <p className={styles.loading}>The record is opening...</p>}
          {!storyEnded && <CombatTargets participants={state?.combatParticipants} disabled={busy} onTarget={(action) => submitAction(action, 'suggested')} />}
          {storyEnded ? <Link className={styles.archiveLink} to="/library">Return to the soul archive</Link> : <ChoiceComposer choices={latest.choices || []} customAction={customAction} onCustomActionChange={setCustomAction} onSubmitAction={submitAction} disabled={busy} />}
        </div>
      </div>
    </main>
  )
}
