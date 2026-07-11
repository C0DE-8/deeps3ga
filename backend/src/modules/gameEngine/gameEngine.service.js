const { continueScene } = require('../deepSaga/deepSaga.service')
const {
  createLegacyHero,
  createGame,
  getGameState,
  listGameSaves,
  markCharacterDead,
  saveNarrativeTurn,
} = require('../../db/repositories/gameState.repository')

async function loadState(storyCycleId, accountId) {
  const state = await getGameState(Number(storyCycleId))
  if (!state) throw new Error('Playable story cycle not found.')
  if (accountId && Number(state.run.account_id) !== Number(accountId)) throw new Error('This story belongs to another player.')
  return state
}

async function continueGame({ storyCycleId, playerAction, actionKind = 'typed' }, accountId) {
  if (!playerAction?.trim()) throw new Error('playerAction is required.')
  if (!['typed', 'suggested'].includes(actionKind)) throw new Error('actionKind must be typed or suggested.')

  const state = await loadState(storyCycleId, accountId)
  const scene = await continueScene({
    playerAction: playerAction.trim(),
    actionKind,
    runState: state.run,
    playerState: {
      characterSheet: state.characterSheet,
      skills: state.skills,
      inventory: state.inventory,
    },
    currentDungeon: state.currentDungeon,
    currentFloor: state.currentFloor,
    activeNpcs: state.activeNpcs,
    activeMonsters: state.activeMonsters,
    activeBoss: state.activeBoss,
    activeQuest: state.activeQuests,
    dungeonMemory: {
      memories: state.storyMemory,
      previousChoices: state.previousChoices,
      adaptations: state.dungeonAdaptations,
      companions: state.companions,
    },
    guardianProfile: state.previousLegacyHero,
  })

  const saved = await saveNarrativeTurn({ state, playerAction: playerAction.trim(), actionKind, scene })
  return { scene, saved }
}

module.exports = {
  completeRun: createLegacyHero,
  continueGame,
  listSaves: listGameSaves,
  killCharacter: markCharacterDead,
  loadState,
  startGame: createGame,
}
