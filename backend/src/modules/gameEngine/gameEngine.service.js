const { continueScene } = require('../deepSaga/deepSaga.service')
const {
  createLegacyHero,
  createGame,
  getGameState,
  listGameSaves,
  listVisibleSkillCatalog,
  markCharacterDead,
  saveNarrativeTurn,
} = require('../../db/repositories/gameState.repository')
const { resolveTurn } = require('./turnEngine.service')
const { interpretAction } = require('./actionInterpreter.service')
const { validateReality } = require('./realityValidator.service')
const { enforceNarrativeScene } = require('../deepSaga/narrativeEnforcer.service')

function asArray(value) {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return [value]
  return [value]
}

function normalizeScene(scene = {}) {
  const protectedKeys = ['account', 'accountId', 'user', 'userId', 'owner', 'ownerId', 'ownership', 'admin', 'role', 'authentication', 'auth']
  const protectedChangeTypes = new Set(['account', 'authentication', 'auth', 'ownership', 'owner', 'admin', 'role', 'user'])
  if (protectedKeys.some((key) => Object.prototype.hasOwnProperty.call(scene, key))) throw new Error('Narrative AI attempted to return protected account state.')
  if (scene.stateChanges !== undefined && !Array.isArray(scene.stateChanges)) throw new Error('Narrative AI stateChanges must be an array.')
  if ((scene.stateChanges || []).some((change) => !change || typeof change !== 'object' || Array.isArray(change) || !change.type)) throw new Error('Narrative AI returned a malformed state change.')
  if ((scene.stateChanges || []).some((change) => protectedChangeTypes.has(String(change.type).toLowerCase()))) throw new Error('Narrative AI attempted to change protected account state.')
  const storyValue = scene.story ?? scene.narrative ?? scene.text ?? ''
  const story = typeof storyValue === 'string'
    ? storyValue
    : storyValue?.text || storyValue?.content || JSON.stringify(storyValue)

  return {
    sceneType: typeof scene.sceneType === 'string' ? scene.sceneType : 'exploration',
    story,
    narrativeSections: scene.narrativeSections && typeof scene.narrativeSections === 'object' ? scene.narrativeSections : {},
    characterChanges: asArray(scene.characterChanges),
    newItemsOrSkills: asArray(scene.newItemsOrSkills),
    choices: scene.choices,
    consequences: asArray(scene.consequences),
    memorySignals: asArray(scene.memorySignals),
    dungeonReaction: asArray(scene.dungeonReaction),
    companionMoments: asArray(scene.companionMoments),
    npcIntroductions: asArray(scene.npcIntroductions),
    storyOpportunities: asArray(scene.storyOpportunities),
    bossPresentation: scene.bossPresentation || null,
    legendSummary: scene.legendSummary || null,
    parsedIntent: scene.parsedIntent && typeof scene.parsedIntent === 'object' ? scene.parsedIntent : {},
    safetyNotes: asArray(scene.safetyNotes),
  }
}

async function loadState(storyCycleId, accountId) {
  const state = await getGameState(Number(storyCycleId))
  if (!state) throw new Error('Playable story cycle not found.')
  if (accountId && Number(state.run.account_id) !== Number(accountId)) throw new Error('This story belongs to another player.')
  return state
}

async function continueGame({ storyCycleId, playerAction, actionKind = 'typed', requestKey }, accountId) {
  if (!playerAction?.trim()) throw new Error('playerAction is required.')
  if (playerAction.trim().length > 1000) throw new Error('playerAction must be 1000 characters or fewer.')
  if (!['typed', 'suggested'].includes(actionKind)) throw new Error('actionKind must be typed or suggested.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey || '')) throw new Error('A valid requestKey is required.')

  const state = await loadState(storyCycleId, accountId)
  const interpreted = await interpretAction(playerAction.trim(), state)
  const interpretation = validateReality(playerAction.trim(), interpreted, state)
  let engineResolution
  if (interpretation.status === 'VALID') {
    engineResolution = await resolveTurn(state, playerAction.trim(), interpretation, requestKey)
  } else {
    engineResolution = {
      actionType: interpretation.intent,
      interpretation,
      successLevel: 'rejected',
      rejection: { status: interpretation.status, reason: interpretation.reason, code: interpretation.rejectionCode, sceneAnchors: interpretation.sceneAnchors || {} },
      rewards: { xp: 0, gold: 0, soulEnergy: 0 },
      skillProgress: [], skillsUnlocked: [], itemsAwarded: [], companions: [], events: [], achievements: [],
      familyMastery: [], ultimateTrials: [], evolutionChoices: [], quests: [], floorProgressGain: 0,
      combat: null, advanced: null, runCompleted: false, died: false,
    }
  }
  const narrativeState = interpretation.status === 'VALID' && !engineResolution.died && !engineResolution.runCompleted
    ? await loadState(storyCycleId, accountId)
    : state
  let scene = normalizeScene(await continueScene({
      playerAction: playerAction.trim(),
      actionKind,
      runState: narrativeState.run,
      worldState: { engineResolution },
      playerState: {
        characterSheet: narrativeState.characterSheet,
        skills: narrativeState.skills,
        inventory: narrativeState.inventory,
        equipment: narrativeState.equipment,
        statuses: narrativeState.statusEffects,
        injuries: narrativeState.injuries,
        achievements: narrativeState.achievements,
        familyMastery: narrativeState.familyMastery,
        evolutionChoices: narrativeState.evolutionChoices,
        ultimateTrials: narrativeState.ultimateTrials,
      },
      previousLocation: { dungeon: state.currentDungeon, floor: state.currentFloor },
      currentDungeon: narrativeState.currentDungeon,
      currentFloor: narrativeState.currentFloor,
      floorStoryBeats: (narrativeState.floorStoryBeats || []).map((beat) => Number(beat.beat_number) === Number(narrativeState.activeStoryBeat?.beat_number)
        ? { ...beat, status: 'active' }
        : { beat_number: beat.beat_number, beat_type: beat.beat_type, title: beat.title, status: Number(beat.beat_number) < Number(narrativeState.activeStoryBeat?.beat_number) ? 'completed' : 'locked' }),
      activeStoryBeat: narrativeState.activeStoryBeat,
      lockedStoryBeats: narrativeState.lockedStoryBeats,
      floorRuntime: narrativeState.floorRuntime,
      activeNpcs: narrativeState.activeNpcs,
      activeMonsters: narrativeState.activeMonsters,
      activeBoss: narrativeState.activeBoss,
      activeQuest: narrativeState.activeQuests,
      activeStoryThreads: narrativeState.activeStoryThreads,
      factionReputation: narrativeState.factionReputation,
      dungeonMemory: {
        memories: narrativeState.storyMemory,
        previousChoices: narrativeState.previousChoices,
        adaptations: narrativeState.dungeonAdaptations,
        companions: narrativeState.companions,
        companionSoulMemories: narrativeState.companionSoulMemories,
        companionInjuries: narrativeState.companionInjuries,
        progression: narrativeState.progressionEvents,
        engineEvents: narrativeState.engineEvents,
        activeEncounter: narrativeState.activeEncounter,
        combatParticipants: narrativeState.combatParticipants,
        events: narrativeState.events,
      },
      guardianProfile: narrativeState.previousLegacyHero,
    }))

  scene = enforceNarrativeScene(scene, engineResolution, { before: state, after: narrativeState })

  const saved = await saveNarrativeTurn({ state, playerAction: playerAction.trim(), actionKind, scene, requestKey })
  let legacyHero = null
  if (engineResolution.runCompleted) legacyHero = await createLegacyHero(Number(storyCycleId), scene.bossPresentation || {})
  return {
    scene,
    engineResolution,
    saved,
    legacyHero,
    location: { dungeon: narrativeState.currentDungeon?.name, floor: narrativeState.currentFloor?.floor_number, floorName: narrativeState.currentFloor?.floor_name },
  }
}

module.exports = {
  completeRun: createLegacyHero,
  continueGame,
  listSaves: listGameSaves,
  listSkills: listVisibleSkillCatalog,
  killCharacter: markCharacterDead,
  loadState,
  startGame: createGame,
  normalizeScene,
}
