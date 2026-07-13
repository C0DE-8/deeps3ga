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
    legacyHero: state.previousLegacyHero,
  }
}

function sceneFromNarrator(result, index, state, action) {
  const scene = result
  const story = scene.story
  return {
    id: `narrative-${result.saved?.narrativeMessageId || index}`,
    chapter: result.location?.dungeon || state.currentDungeon?.name || 'Deep Saga',
    title: result.location?.floorName || state.currentFloor?.floor_name || 'The next page',
    playerAction: action,
    paragraphs: story.split(/\n\s*\n/).filter(Boolean),
    choices: scene.choices || [],
    recordChanges: scene.recordChanges || [],
    actionResolution: scene.actionResolution || null,
    stateChanges: scene.stateChanges || null,
    status: {
      hp: state.characterSheet.hp,
      mp: state.characterSheet.mana,
      level: state.characterSheet.level,
      dungeon: state.currentDungeon?.name,
      floor: `Floor ${state.currentFloor?.floor_number}`,
    },
  }
}

function scenesFromHistory(state) {
  const scenes = []
  let playerAction = ''
  for (const message of state.narrativeHistory || []) {
    if (message.speaker === 'player') {
      playerAction = message.message_text
      continue
    }
    if (message.speaker !== 'narrator') continue
    const consequence = Array.isArray(message.consequence_json) ? message.consequence_json : []
    scenes.push({
      id: `saved-${message.id}`,
      chapter: state.currentDungeon.name,
      title: state.currentFloor.floor_name,
      playerAction,
      paragraphs: String(message.message_text || '').split(/\n\s*\n/).filter(Boolean),
      choices: message.choices_json || [],
      recordChanges: consequence.find((entry) => entry?.acceptedTurn)?.acceptedTurn?.recordChanges || [],
      actionResolution: consequence.find((entry) => entry?.acceptedTurn)?.acceptedTurn?.actionResolution || null,
      stateChanges: consequence.find((entry) => entry?.acceptedTurn)?.acceptedTurn?.stateChanges || null,
    })
    playerAction = ''
  }
  return scenes
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
  const pendingRequestRef = useRef(null)

  useEffect(() => {
    fetchGameState(cycleId).then((loaded) => {
      setState(loaded)
      const history = scenesFromHistory(loaded)
      if (history.length) setScenes(history)
    }).catch((e) => setError(e.response?.data?.message || 'This story could not be opened.')).finally(() => setBusy(false))
  }, [cycleId])
  useEffect(() => { if (scenes.length > 1) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [scenes.length])

  async function submitAction(action, actionKind = 'typed', targetReference = null) {
    if (busy) return
    setBusy(true); setError('')
    const targetCatalog = [
      ...(state?.reachableTargets || []),
      ...(state?.activeNpcs || []).map((npc) => ({ type: 'npc', id: npc.id, name: npc.name })),
      ...(state?.companions || []).map((companion) => ({ type: 'companion', id: companion.id, name: companion.name })),
    ]
    const selectedTarget = targetReference ? targetCatalog.find((target) => target.type === targetReference.type && Number(target.id) === Number(targetReference.id)) || targetReference : null
    const targetKey = selectedTarget ? `${selectedTarget.type}:${selectedTarget.id}:${selectedTarget.name || ''}` : ''
    const samePendingAction = pendingRequestRef.current?.action === action && pendingRequestRef.current?.actionKind === actionKind && pendingRequestRef.current?.targetKey === targetKey
    const requestKey = samePendingAction ? pendingRequestRef.current.requestKey : crypto.randomUUID()
    pendingRequestRef.current = { action, actionKind, targetKey, requestKey }
    try {
      const result = await continueNarrative({ storyCycleId: Number(cycleId), playerAction: action, actionKind, selectedTarget, requestKey })
      setScenes((current) => [...current, sceneFromNarrator(result, current.length, state, action)])
      setCustomAction('')
      if (!result.stateChanges?.characterDied && !result.stateChanges?.runCompleted) {
        setState(await fetchGameState(cycleId))
      }
      pendingRequestRef.current = null
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The narrator fell silent. Try this action again.')
    } finally { setBusy(false) }
  }

  const latest = scenes.at(-1)
  const storyEnded = latest.stateChanges?.characterDied || latest.stateChanges?.runCompleted
  const status = state ? { hp: state.characterSheet.hp, maxHp: state.characterSheet.max_hp, mp: state.characterSheet.mana, maxMp: state.characterSheet.max_mana, level: state.characterSheet.level, dungeon: state.currentDungeon.name, floor: `Floor ${state.currentFloor.floor_number}` } : latest.status
  return (
    <main className={styles.reader}>
      <AppHeader compact />
      <StatusBar status={status} skills={state?.skills || []} />
      <button className={styles.sheetToggle} type="button" onClick={() => setSheetOpen((open) => !open)} title={sheetOpen ? 'Close character sheet' : 'Open character sheet'}>
        <span className={styles.locationText}><small>Current location</small><strong>{status.dungeon}</strong><em>{status.floor}</em></span>
        {sheetOpen ? <PanelRightClose /> : <PanelRightOpen />}
      </button>
      <aside className={`${styles.sheetDrawer} ${sheetOpen ? styles.open : ''}`}>{state && <CharacterSheet character={characterFromState(state)} />}</aside>
      <div className={styles.storyStream}>
        {scenes.map((scene, index) => <div className={styles.sceneWrap} key={scene.id} ref={index === scenes.length - 1 ? endRef : null}><StoryPanel scene={scene} /><EngineResults recordChanges={scene.recordChanges} />{index < scenes.length - 1 && <ChevronDown className={styles.pageBreak} size={20} />}</div>)}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.currentChoice}>
          {busy && scenes.length === 1 && <p className={styles.loading}>The record is opening...</p>}
          {!storyEnded && <CombatTargets targets={state?.reachableTargets} disabled={busy} onTarget={({ playerAction, selectedTarget }) => submitAction(playerAction, 'suggested', selectedTarget)} />}
          {storyEnded ? <Link className={styles.archiveLink} to="/library">Return to the soul archive</Link> : <ChoiceComposer choices={latest.choices || []} customAction={customAction} onCustomActionChange={setCustomAction} onSubmitAction={submitAction} disabled={busy} />}
        </div>
      </div>
    </main>
  )
}
