const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { loadEnvFile } = require('../src/config/loadEnv')
const { getPool, query } = require('../src/db/connection')
const { createGame, getGameState } = require('../src/db/repositories/gameState.repository')
const { saveAcceptedTurn } = require('../src/db/repositories/aiTurn.repository')
const { validateGameMasterTurn } = require('../src/modules/deepSaga/narrativeEnforcer.service')
const { loadState } = require('../src/modules/gameEngine/gameEngine.service')

loadEnvFile()

function makeChoices(state, target) {
  const floor = state.currentFloor.floor_name
  return [
    { id: 'hold-target-line', title: 'Hold the wounded line', text: `Keep pressure on ${target.name} while using the broken ground of ${floor} to limit its movement.`, action: `I keep pressure on ${target.name} and use the broken ground to limit it.`, direction: 'aggressive', targetType: target.type, targetId: target.id },
    { id: 'read-target-movement', title: 'Read the creature closely', text: `Study ${target.name}'s wounded movement before committing another attack near the floor objective.`, action: `I study ${target.name}'s wounded movement and search for a reliable opening.`, direction: 'investigative', targetType: target.type, targetId: target.id },
    { id: 'withdraw-from-target', title: 'Create deliberate distance', text: `Use the terrain around ${floor} to create distance from ${target.name} without abandoning the objective.`, action: `I create distance from ${target.name} while remaining near the floor objective.`, direction: 'cautious', targetType: target.type, targetId: target.id },
  ]
}

async function run() {
  const username = `idempotency_${Date.now()}`
  const account = await query("INSERT INTO accounts (username, email, role) VALUES (?, ?, 'player')", [username, `${username}@example.invalid`])
  try {
    const game = await createGame(account.insertId)
    const state = await getGameState(game.storyCycleId)
    const target = state.reachableTargets.find((entry) => entry.type === 'monster')
    assert.ok(target, 'The seeded first floor must expose a reachable monster target.')
    const requestKey = crypto.randomUUID()
    const selectedTarget = { type: target.type, id: target.id, name: target.name }
    const rawTurn = {
      sceneType: 'combat',
      actionResolution: { intent: 'ATTACK', outcome: 'PARTIAL_SUCCESS', targetType: target.type, targetId: target.id, targetName: target.name, targetChangedReason: null, summary: `The attack wounds ${target.name}.` },
      story: `The attack reaches ${target.name} and opens a shallow wound, but the creature remains standing in ${state.currentFloor.floor_name}. The other present threats keep their distance, untouched by the single-target strike, while the floor objective remains unresolved.`,
      stateChanges: {
        playerHpDelta: 0, playerManaDelta: 0, playerStaminaDelta: -1, goldDelta: 0, playerXpDelta: 0, soulEnergyDelta: 0,
        targets: [{ type: target.type, id: target.id, name: target.name, hpDelta: -1, newStatuses: [], removedStatuses: [] }],
        playerStatusesAdded: [], playerStatusesRemoved: [], playerStatusUpdates: [], itemsAdded: [], itemsRemoved: [], skillsAdded: [], questUpdates: [], relationshipChanges: [],
        floorComplete: false, exitUnlocked: false, floorChange: null, bossDefeated: false, characterDied: false, runCompleted: false,
      },
      recordChanges: [{ type: 'damage', text: `1 damage to ${target.name}`, targetType: target.type, targetId: target.id }, { type: 'stamina', text: '1 Stamina spent' }],
      choices: makeChoices(state, target),
      memoryUpdates: [{ type: 'combat', text: `The character wounded ${target.name} with a direct attack.` }],
    }
    const turn = validateGameMasterTurn(rawTurn, state, { selectedTarget })
    const first = await saveAcceptedTurn({ state, playerAction: 'attack', actionKind: 'suggested', selectedTarget, requestKey, turn })
    const second = await saveAcceptedTurn({ state, playerAction: 'attack', actionKind: 'suggested', selectedTarget, requestKey, turn })
    assert.equal(second.saved.replayed, true)
    assert.deepEqual(second.turn, first.turn)

    const after = await getGameState(game.storyCycleId)
    const changed = after.activeMonsters.find((monster) => Number(monster.instance_id) === Number(target.id))
    assert.equal(Number(changed.current_hp), Number(target.hp) - 1)
    for (const untouched of state.reachableTargets.filter((entry) => entry.type === 'monster' && entry.id !== target.id)) {
      const current = after.activeMonsters.find((monster) => Number(monster.instance_id) === Number(untouched.id))
      assert.equal(Number(current.current_hp), Number(untouched.hp))
    }
    assert.equal(Number(after.characterSheet.stamina), Number(state.characterSheet.stamina) - 1)
    assert.deepEqual(after.reachableTargets.map((entry) => entry.id).sort((a, b) => a - b), state.reachableTargets.map((entry) => entry.id).sort((a, b) => a - b))
    const messages = await query('SELECT COUNT(*) AS count FROM narrative_messages WHERE story_cycle_id = ? AND request_key = ?', [game.storyCycleId, requestKey])
    assert.equal(Number(messages[0].count), 2)
    const memories = await query("SELECT COUNT(*) AS count FROM story_memories WHERE story_cycle_id = ? AND memory_key LIKE ?", [game.storyCycleId, `ai-turn-${requestKey}-%`])
    assert.equal(Number(memories[0].count), 1)

    const other = await query("INSERT INTO accounts (username, email, role) VALUES (?, ?, 'player')", [`other_${username}`, `other_${username}@example.invalid`])
    await assert.rejects(() => loadState(game.storyCycleId, other.insertId), /another player/)
    await query('DELETE FROM accounts WHERE id = ?', [other.insertId])
    console.log('AI turn atomicity and idempotency checks passed.')
  } finally {
    await query('DELETE FROM accounts WHERE id = ?', [account.insertId])
  }
}

run().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
}).finally(() => getPool().end())
