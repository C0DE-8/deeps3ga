const { loadEnvFile } = require('../src/config/loadEnv')
const { getPool, query } = require('../src/db/connection')
const { createGame, createLegacyHero, getGameState } = require('../src/db/repositories/gameState.repository')
const { resolveTurn } = require('../src/modules/gameEngine/turnEngine.service')

loadEnvFile()

async function playCompleteRun(accountId, finalTitle) {
  const game = await createGame(accountId)
  let state = await getGameState(game.storyCycleId)
  let turns = 0
  let runCompleted = false
  let maraRecruited = false

  while (!runCompleted && turns < 500) {
    const realm = Number(state.currentDungeon.dungeon_number)
    const floor = Number(state.currentFloor.floor_number)
    const bossFloor = floor === 5
    let action = bossFloor ? 'I attack with everything I have.' : 'I inspect the path and continue forward carefully.'
    if (realm === 1 && floor === 2 && state.activeMonsters.length) action = `I attack ${state.activeMonsters[0].name}.`
    if (realm === 1 && floor === 3 && !maraRecruited) {
      action = 'Mara Fenroot, join me and protect the people traveling this forest.'
      maraRecruited = true
    }
    if (realm === 1 && floor === 4 && state.activeMonsters.length) action = `I attack ${state.activeMonsters[0].name}.`
    const result = await resolveTurn(state, action)
    turns += 1
    if (result.died) throw new Error(`Simulation died in Realm ${state.currentDungeon.dungeon_number}, Floor ${state.currentFloor.floor_number}.`)
    runCompleted = result.runCompleted
    if (!runCompleted) state = await getGameState(game.storyCycleId)
  }

  if (!runCompleted) throw new Error('Simulation exceeded the turn limit.')
  const legacy = await createLegacyHero(game.storyCycleId, { finalTitle })
  const progress = await query('SELECT COUNT(*) AS count FROM cycle_dungeon_progress WHERE story_cycle_id = ? AND boss_defeated = 1', [game.storyCycleId])
  const events = await query('SELECT COUNT(*) AS count FROM character_progression_events WHERE story_cycle_id = ?', [game.storyCycleId])
  const skills = await query('SELECT COUNT(*) AS count FROM character_skills WHERE character_life_id = ?', [game.characterLifeId])
  const legacyEncounters = await query("SELECT COUNT(*) AS count FROM combat_encounters WHERE story_cycle_id = ? AND encounter_type = 'legacy_boss' AND status = 'victory'", [game.storyCycleId])
  const multiEnemyEncounters = await query("SELECT COUNT(*) AS count FROM (SELECT combat_encounter_id FROM combat_participants WHERE team = 'enemy' GROUP BY combat_encounter_id HAVING COUNT(*) > 1) grouped JOIN combat_encounters ce ON ce.id = grouped.combat_encounter_id WHERE ce.story_cycle_id = ?", [game.storyCycleId])
  const companionActions = await query("SELECT COUNT(*) AS count FROM combat_action_logs cal JOIN combat_encounters ce ON ce.id = cal.combat_encounter_id WHERE ce.story_cycle_id = ? AND cal.actor_type = 'companion'", [game.storyCycleId])
  const recruitedCompanions = await query("SELECT COUNT(*) AS count FROM companions WHERE story_cycle_id = ? AND recruited_at IS NOT NULL", [game.storyCycleId])

  return {
    storyCycleId: game.storyCycleId,
    turns,
    realmsCleared: Number(progress[0].count),
    progressionEvents: Number(events[0].count),
    skillsOwned: Number(skills[0].count),
    legacyHeroId: legacy.id,
    legacyBossesDefeated: Number(legacyEncounters[0].count),
    multiEnemyEncounters: Number(multiEnemyEncounters[0].count),
    companionCombatActions: Number(companionActions[0].count),
    companionsRecruited: Number(recruitedCompanions[0].count),
  }
}

async function simulateJourney() {
  const username = `journey_test_${Date.now()}`
  const account = await query("INSERT INTO accounts (username, email, role) VALUES (?, ?, 'player')", [username, `${username}@example.invalid`])
  const accountId = account.insertId
  const legacyIds = []

  try {
    const firstRun = await playCompleteRun(accountId, 'The First Test Conqueror')
    legacyIds.push(firstRun.legacyHeroId)
    const secondRun = await playCompleteRun(accountId, 'The Legacy Test Conqueror')
    legacyIds.push(secondRun.legacyHeroId)
    if (secondRun.legacyBossesDefeated !== 1) throw new Error('Second run did not defeat the previous Legacy Hero.')
    console.log(JSON.stringify({ success: true, firstRun, secondRun }, null, 2))
  } finally {
    for (const legacyId of legacyIds.reverse()) await query('DELETE FROM legacy_heroes WHERE id = ?', [legacyId])
    await query('DELETE FROM accounts WHERE id = ?', [accountId])
  }
}

simulateJourney().catch((error) => {
  console.error(error?.stack || error?.message || error)
  process.exitCode = 1
}).finally(() => getPool().end())
