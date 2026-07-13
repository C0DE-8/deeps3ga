const crypto = require('node:crypto')
const { loadEnvFile } = require('../src/config/loadEnv')
const { getPool, query } = require('../src/db/connection')
const { createGame, createLegacyHero, getGameState } = require('../src/db/repositories/gameState.repository')
const { saveAcceptedTurn } = require('../src/db/repositories/aiTurn.repository')
const { validateGameMasterTurn } = require('../src/modules/deepSaga/narrativeEnforcer.service')

loadEnvFile()

function choices(state, anchor) {
  const floor = state.currentFloor.floor_name
  return [
    { id: 'follow-floor-objective', title: 'Follow the discovered path', text: `Use the evidence found in ${floor} to pursue ${anchor} without abandoning the saved Floor objective.`, action: `I use the evidence from ${floor} to pursue ${anchor}.`, direction: 'decisive', targetType: null, targetId: null },
    { id: 'protect-present-allies', title: 'Protect the people present', text: `Coordinate with the people still present in ${floor} before ${anchor} creates another danger.`, action: `I protect the people present and prepare them for ${anchor}.`, direction: 'protective', targetType: null, targetId: null },
    { id: 'prepare-next-consequence', title: 'Prepare for the consequence', text: `Study the current location and prepare a specific answer to ${anchor} while the opportunity remains.`, action: `I prepare a deliberate answer to ${anchor} using what this Floor revealed.`, direction: 'tactical', targetType: null, targetId: null },
  ]
}

function emptyChanges(overrides = {}) {
  return {
    playerHpDelta: 0, playerManaDelta: 0, playerStaminaDelta: 0, goldDelta: 0, playerXpDelta: 0, soulEnergyDelta: 0,
    targets: [], playerStatusesAdded: [], playerStatusesRemoved: [], playerStatusUpdates: [], itemsAdded: [], itemsRemoved: [], skillsAdded: [], questUpdates: [], relationshipChanges: [],
    floorComplete: false, exitUnlocked: false, floorChange: null, bossDefeated: false, characterDied: false, runCompleted: false,
    ...overrides,
  }
}

async function persist(state, playerAction, rawTurn, selectedTarget = null) {
  const turn = validateGameMasterTurn(rawTurn, state, { playerAction, selectedTarget })
  await saveAcceptedTurn({ state, playerAction, actionKind: 'typed', selectedTarget, requestKey: crypto.randomUUID(), turn })
  return getGameState(state.run.id)
}

async function completeStoryFloor(state) {
  const objective = state.currentFloor.story_purpose
  return persist(state, 'I complete the Floor objective using the people, evidence, and dangers established here.', {
    sceneType: 'exploration',
    actionResolution: { intent: 'RESOLVE_OBJECTIVE', outcome: 'SUCCESS', targetType: null, targetId: null, targetName: null, targetChangedReason: null, summary: `The objective of ${state.currentFloor.floor_name} is resolved.` },
    story: `The conflict woven through ${state.currentFloor.floor_name} reaches a confirmed end through choices already made, dangers faced, and evidence recovered. ${objective} The way onward reveals itself only after that consequence settles into the Dungeon's memory.`,
    stateChanges: emptyChanges({ floorComplete: true, exitUnlocked: true }),
    recordChanges: [{ type: 'floor', text: `${state.currentFloor.floor_name} objective completed and its exit unlocked` }],
    choices: choices(state, 'the newly opened route'),
    memoryUpdates: [{ type: 'floor', text: `The character completed ${state.currentFloor.floor_name}: ${objective}` }],
    floorComplete: true,
    exitUnlocked: true,
    bossState: null,
  })
}

async function fightBoss(state, finishingBlow) {
  const boss = state.activeBoss
  const damage = finishingBlow ? Number(boss.current_hp) : Math.max(1, Math.floor(Number(boss.current_hp) / 2))
  const defeated = damage >= Number(boss.current_hp)
  const selectedTarget = { type: 'boss', id: Number(boss.id), name: boss.boss_name }
  return persist(state, `I attack ${boss.boss_name} using the weakness established on the previous Floors.`, {
    sceneType: 'boss',
    actionResolution: { intent: 'ATTACK', outcome: defeated ? 'SUCCESS' : 'PARTIAL_SUCCESS', targetType: 'boss', targetId: Number(boss.id), targetName: boss.boss_name, targetChangedReason: null, summary: defeated ? `${boss.boss_name} falls after the sustained confrontation.` : `${boss.boss_name} is wounded but enters another phase.` },
    story: defeated
      ? `The confrontation with ${boss.boss_name} reaches its final exchange only after the earlier wounds and discoveries matter. The established weakness breaks beneath the attack, the last ${damage} HP leaves the guardian, and the boss falls without erasing the cost of the battle.`
      : `The first decisive exchange tears ${damage} HP from ${boss.boss_name}, but the boss does not fall. It changes its stance and exposes a harsher phase, forcing the character to carry the fight forward rather than claiming an instant victory.`,
    stateChanges: emptyChanges({
      targets: [{ type: 'boss', id: Number(boss.id), name: boss.boss_name, hpDelta: -damage, newStatuses: [], removedStatuses: [] }],
      floorComplete: defeated,
      exitUnlocked: defeated,
      bossDefeated: defeated,
      runCompleted: defeated && Number(state.currentDungeon.dungeon_number) === 5,
    }),
    recordChanges: [
      { type: 'damage', text: `${damage} damage to ${boss.boss_name}`, targetType: 'boss', targetId: Number(boss.id) },
      ...(defeated ? [{ type: 'boss', text: `${boss.boss_name} defeated after the completed confrontation`, targetType: 'boss', targetId: Number(boss.id) }] : []),
    ],
    choices: defeated && Number(state.currentDungeon.dungeon_number) === 5 ? [] : choices(state, defeated ? 'the opened Dungeon passage' : `${boss.boss_name}'s next phase`),
    memoryUpdates: [{ type: 'boss', text: defeated ? `${boss.boss_name} was defeated after a multi-turn battle.` : `${boss.boss_name} survived the first decisive attack and entered another phase.` }],
    floorComplete: defeated,
    exitUnlocked: defeated,
    bossState: { id: Number(boss.id), name: boss.boss_name, hp: Math.max(0, Number(boss.current_hp) - damage), defeated },
  }, selectedTarget)
}

async function moveForward(state) {
  const exit = state.availableFloorExits[0]
  if (!exit) return state
  return persist(state, `I take the unlocked passage to ${exit.floor_name}.`, {
    sceneType: 'floor_transition',
    actionResolution: { intent: 'MOVE', outcome: 'SUCCESS', targetType: null, targetId: null, targetName: null, targetChangedReason: null, summary: `The character enters ${exit.floor_name}.` },
    story: `With the objective behind them and the exit already open, the character leaves ${state.currentFloor.floor_name}. The passage carries the consequences forward into ${exit.floor_name}, where a new location and conflict wait rather than an unexplained skip.`,
    stateChanges: emptyChanges({ floorChange: { floorId: Number(exit.id) } }),
    recordChanges: [{ type: 'floor', text: `Entered ${exit.dungeon_name}, Floor ${exit.floor_number}: ${exit.floor_name}` }],
    choices: choices(state, `the arrival at ${exit.floor_name}`),
    memoryUpdates: [{ type: 'location', text: `The character entered ${exit.floor_name}.` }],
    floorComplete: false,
    exitUnlocked: false,
    bossState: null,
  })
}

async function playCompleteRun(accountId, finalTitle) {
  const game = await createGame(accountId)
  let state = await getGameState(game.storyCycleId)
  let turns = 0

  while (turns < 60) {
    if (state.currentFloor.floor_type === 'boss') {
      state = await fightBoss(state, false)
      turns += 1
      state = await fightBoss(state, true)
      turns += 1
      if (Number(state.currentDungeon.dungeon_number) === 5) break
    } else {
      state = await completeStoryFloor(state)
      turns += 1
    }
    state = await moveForward(state)
    turns += 1
  }

  if (Number(state.currentDungeon.dungeon_number) !== 5 || Number(state.currentFloor.floor_number) !== 3 || Number(state.activeBoss?.current_hp) > 0) throw new Error('Simulation did not complete Dungeon 5, Floor 3.')
  const legacy = await createLegacyHero(game.storyCycleId, { finalTitle })
  const progress = await query('SELECT COUNT(*) AS count FROM cycle_dungeon_progress WHERE story_cycle_id = ? AND boss_defeated = 1', [game.storyCycleId])
  return { storyCycleId: game.storyCycleId, turns, dungeonsCleared: Number(progress[0].count), legacyHeroId: legacy.id }
}

async function simulateJourney() {
  const username = `journey_test_${Date.now()}`
  const account = await query("INSERT INTO accounts (username, email, role) VALUES (?, ?, 'player')", [username, `${username}@example.invalid`])
  try {
    const firstRun = await playCompleteRun(account.insertId, 'The Fivefold Conqueror')
    const secondGame = await createGame(account.insertId)
    const secondState = await getGameState(secondGame.storyCycleId)
    if (Number(secondState.previousLegacyHero?.id) !== Number(firstRun.legacyHeroId)) throw new Error('The next run did not load the completed Legacy Hero.')
    console.log(JSON.stringify({ success: true, firstRun, nextRun: { storyCycleId: secondGame.storyCycleId, previousLegacyHeroId: secondState.previousLegacyHero.id } }, null, 2))
  } finally {
    await query('DELETE FROM legacy_heroes WHERE soul_profile_id IN (SELECT id FROM soul_profiles WHERE account_id = ?)', [account.insertId])
    await query('DELETE FROM accounts WHERE id = ?', [account.insertId])
  }
}

simulateJourney().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
}).finally(() => getPool().end())
