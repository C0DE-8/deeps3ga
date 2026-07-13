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
  const storyValue = scene.story ?? scene.narrative ?? scene.text ?? ''
  const story = typeof storyValue === 'string'
    ? storyValue
    : storyValue?.text || storyValue?.content || JSON.stringify(storyValue)

  return {
    ...scene,
    story,
    characterChanges: asArray(scene.characterChanges),
    newItemsOrSkills: asArray(scene.newItemsOrSkills),
    choices: asArray(scene.choices),
    consequences: asArray(scene.consequences),
    memorySignals: asArray(scene.memorySignals),
    dungeonReaction: asArray(scene.dungeonReaction),
    companionMoments: asArray(scene.companionMoments),
    bossPresentation: scene.bossPresentation || null,
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
  let scene
  const hardRejection = ['rule_manipulation', 'reality_breaking_action'].includes(interpretation.intent)
  if (hardRejection) {
    scene = normalizeScene({
      story: buildFallbackStory(engineResolution, state),
      choices: ['Describe a possible action.', 'Study what is actually present.', 'Check your character sheet.'],
      safetyNotes: [`Action rejected by reality validation: ${interpretation.status}`],
    })
  } else {
    try {
      scene = normalizeScene(await continueScene({
      playerAction: playerAction.trim(),
      actionKind,
      runState: state.run,
      worldState: { engineResolution },
      playerState: {
        characterSheet: state.characterSheet,
        skills: state.skills,
        inventory: state.inventory,
        equipment: state.equipment,
        statuses: state.statusEffects,
        injuries: state.injuries,
        achievements: state.achievements,
        familyMastery: state.familyMastery,
        evolutionChoices: state.evolutionChoices,
        ultimateTrials: state.ultimateTrials,
      },
      currentDungeon: state.currentDungeon,
      currentFloor: state.currentFloor,
      floorStoryBeats: (state.floorStoryBeats || []).map((beat) => Number(beat.beat_number) === Number(state.activeStoryBeat?.beat_number)
        ? { ...beat, status: 'active' }
        : { beat_number: beat.beat_number, beat_type: beat.beat_type, title: beat.title, status: Number(beat.beat_number) < Number(state.activeStoryBeat?.beat_number) ? 'completed' : 'locked' }),
      activeStoryBeat: state.activeStoryBeat,
      lockedStoryBeats: state.lockedStoryBeats,
      floorRuntime: state.floorRuntime,
      activeNpcs: state.activeNpcs,
      activeMonsters: state.activeMonsters,
      activeBoss: state.activeBoss,
      activeQuest: state.activeQuests,
      dungeonMemory: {
        memories: state.storyMemory,
        previousChoices: state.previousChoices,
        adaptations: state.dungeonAdaptations,
        companions: state.companions,
        companionSoulMemories: state.companionSoulMemories,
        companionInjuries: state.companionInjuries,
        progression: state.progressionEvents,
        engineEvents: state.engineEvents,
        activeEncounter: state.activeEncounter,
        combatParticipants: state.combatParticipants,
        events: state.events,
      },
      guardianProfile: state.previousLegacyHero,
      }))
    } catch (error) {
      scene = normalizeScene({
        story: buildFallbackStory(engineResolution, state),
        choices: engineResolution.died || engineResolution.runCompleted
          ? []
          : ['Continue forward.', 'Study the surroundings.', 'Check on your condition.'],
        consequences: [engineResolution],
        memorySignals: [],
        safetyNotes: [`Narrator fallback used: ${error.message}`],
      })
    }
  }

  scene = enforceNarrativeScene(scene, engineResolution, buildFallbackStory(engineResolution, state))

  const saved = await saveNarrativeTurn({ state, playerAction: playerAction.trim(), actionKind, scene, requestKey })
  let legacyHero = null
  if (engineResolution.runCompleted) legacyHero = await createLegacyHero(Number(storyCycleId), scene.bossPresentation || {})
  return { scene, engineResolution, saved, legacyHero }
}

function buildFallbackStory(resolution, state = {}) {
  const lines = []
  const rejection = resolution.rejection
  const anchors = rejection?.sceneAnchors || {}
  if (rejection?.code === 'target_non_hostile') {
    lines.push(`You prepare to strike, but ${anchors.target || 'the figure before you'} does not answer with aggression. It recoils, searching for distance rather than an opening to attack.`)
    lines.push(`${anchors.atmosphere || state.currentFloor?.atmosphere || 'The surrounding path'} presses close around the unfinished movement. Whatever brought ${anchors.target || 'it'} here has not yet shown itself.`)
  } else if (rejection?.code === 'target_absent') {
    lines.push('Your attack cuts through empty space. The target you imagined is nowhere within reach, and the sound of the movement travels farther than you intended.')
    const present = [...(anchors.presentNpcs || []), ...(anchors.presentCreatures || [])]
    if (present.length) lines.push(`${present.join(', ')} ${present.length === 1 ? 'is' : 'are'} still here, watching what you do next.`)
  } else if (rejection?.code === 'nothing_to_escape') {
    lines.push('You gather yourself to run, but no pursuit follows. The path remains open, leaving you to choose a direction instead of fleeing blind.')
  } else if (rejection?.code === 'ability_not_owned') {
    lines.push('You reach for the shape of that power, but nothing answers. The instinct has no place in this body yet, and the moment passes without the world yielding to it.')
  } else if (rejection?.code === 'item_not_available') {
    lines.push('Your hand searches for the item and closes on empty cloth. Whatever plan depended on it must change before the danger does.')
  } else if (rejection?.code === 'environment_not_available') {
    lines.push('You look for the feature your plan depends on, but the surroundings offer no such advantage. The idea must bend around what is actually here.')
  } else if (rejection) {
    lines.push(rejection.status === 'AMBIGUOUS' || rejection.status === 'UNKNOWN'
      ? 'You hesitate between intentions, and the moment refuses to choose for you. A clearer action is needed before anything changes.'
      : 'You attempt to force the moment beyond what this body and world permit. Nothing answers, and the scene remains exactly as it was.')
  }
  if (resolution.combat?.escape?.escaped) lines.push('You break away before the enemy can close the distance. Its pursuit fades behind you.')
  if (resolution.combat?.escape && !resolution.combat.escape.escaped) lines.push('You turn to run, but the enemy reads the movement and cuts off your escape.')
  if (resolution.combat?.playerDamage) lines.push(`Your action lands for ${resolution.combat.playerDamage} damage against ${resolution.combat.enemyName}.`)
  if (resolution.combat?.enemyDamage) lines.push(`${resolution.combat.enemyName} answers, and the impact costs you ${resolution.combat.enemyDamage} HP.`)
  if (resolution.combat?.status === 'victory') lines.push(`${resolution.combat.enemyName} can no longer continue. The encounter is won.`)
  if (resolution.combat?.status === 'resolved_peacefully') lines.push('The violence ends without another life being taken.')
  if (resolution.rewards.xp) lines.push(`Experience settles into the body: ${resolution.rewards.xp} XP.`)
  if (resolution.rewards.gold) lines.push(`You recover ${resolution.rewards.gold} Gold.`)
  for (const item of resolution.itemsAwarded) lines.push(`Among what remains, you find ${item.name}.`)
  if (resolution.levelUp) lines.push(`Strength gathers through you. You have reached Level ${resolution.levelUp.newLevel}.`)
  for (const skill of resolution.skillsUnlocked) lines.push(`${skill.identityText || 'A new instinct awakens.'} Skill unlocked: ${skill.name}.`)
  if (resolution.advanced?.type === 'floor') lines.push(`The path opens to Floor ${resolution.advanced.floor}.`)
  if (resolution.advanced?.type === 'realm') lines.push(`The defeated Realm releases you. Realm ${resolution.advanced.dungeon} waits ahead.`)
  if (resolution.died) lines.push('The body falls silent. This life is over, but the soul remembers.')
  if (resolution.runCompleted) lines.push('All ten Realms stand behind you. The Dungeon claims this victorious body as a legend.')
  if (!lines.length) lines.push('The Dungeon receives your decision and shifts around its consequence.')
  return lines.join('\n\n')
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
  buildFallbackStory,
}
