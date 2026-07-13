const { continueScene } = require('../deepSaga/deepSaga.service')
const {
  createLegacyHero,
  createGame,
  getGameState,
  listGameSaves,
  listVisibleSkillCatalog,
  markCharacterDead,
} = require('../../db/repositories/gameState.repository')
const { findAcceptedTurn, saveAcceptedTurn } = require('../../db/repositories/aiTurn.repository')
const { AiTurnValidationError, buildTurnContext, validateGameMasterTurn } = require('../deepSaga/narrativeEnforcer.service')

function normalizeSelectedTarget(value) {
  if (value === null || value === undefined) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('selectedTarget must be an object.')
  const type = String(value.type || '').trim().toLowerCase()
  const id = Number(value.id)
  const name = String(value.name || '').trim()
  if (!type || !Number.isInteger(id) || id <= 0 || !name) throw new Error('selectedTarget requires type, positive integer id, and name.')
  return { type, id, name: name.slice(0, 160) }
}

async function loadState(storyCycleId, accountId) {
  const state = await getGameState(Number(storyCycleId))
  if (!state) throw new Error('Playable story cycle not found.')
  if (accountId && Number(state.run.account_id) !== Number(accountId)) throw new Error('This story belongs to another player.')
  return state
}

async function requestAcceptedTurn({ state, playerAction, actionKind, selectedTarget }) {
  const turnContext = buildTurnContext(state)
  let validationErrors = []
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await continueScene({ playerAction, actionKind, selectedTarget, turnContext, validationErrors })
      return validateGameMasterTurn(raw, state, { playerAction, selectedTarget })
    } catch (error) {
      const repairable = error instanceof AiTurnValidationError || error instanceof SyntaxError
      if (!repairable || attempt === 1) throw error
      validationErrors = error instanceof AiTurnValidationError ? error.validationErrors : [`The previous response was not valid JSON: ${error.message}`]
    }
  }
  throw new Error('AI Game Master did not return a valid turn.')
}

async function continueGame({ storyCycleId, playerAction, actionKind = 'typed', selectedTarget: selectedTargetValue = null, requestKey }, accountId) {
  if (!playerAction?.trim()) throw new Error('playerAction is required.')
  if (playerAction.trim().length > 1000) throw new Error('playerAction must be 1000 characters or fewer.')
  if (!['typed', 'suggested'].includes(actionKind)) throw new Error('actionKind must be typed or suggested.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey || '')) throw new Error('A valid requestKey is required.')

  const state = await loadState(storyCycleId, accountId)
  const selectedTarget = normalizeSelectedTarget(selectedTargetValue)
  const existing = await findAcceptedTurn(state.run.id, requestKey, playerAction.trim(), selectedTarget)
  if (existing) {
    const current = await loadState(storyCycleId, accountId)
    return { ...existing, saved: { replayed: true }, location: { dungeon: current.currentDungeon.name, floor: current.currentFloor.floor_number, floorName: current.currentFloor.floor_name }, reachableTargets: current.reachableTargets }
  }

  const acceptedTurn = await requestAcceptedTurn({ state, playerAction: playerAction.trim(), actionKind, selectedTarget })
  const result = await saveAcceptedTurn({ state, playerAction: playerAction.trim(), actionKind, selectedTarget, requestKey, turn: acceptedTurn })
  const current = await loadState(storyCycleId, accountId)
  let legacyHero = null
  if (acceptedTurn.stateChanges.runCompleted) legacyHero = await createLegacyHero(Number(storyCycleId), {})
  return {
    ...result.turn,
    saved: result.saved,
    legacyHero,
    location: { dungeon: current.currentDungeon.name, floor: current.currentFloor.floor_number, floorName: current.currentFloor.floor_name },
    reachableTargets: current.reachableTargets,
  }
}

module.exports = {
  completeRun: createLegacyHero,
  continueGame,
  listSaves: listGameSaves,
  listSkills: listVisibleSkillCatalog,
  killCharacter: markCharacterDead,
  loadState,
  normalizeSelectedTarget,
  requestAcceptedTurn,
  startGame: createGame,
}
