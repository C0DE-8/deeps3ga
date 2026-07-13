const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { loadEnvFile } = require('../src/config/loadEnv')
const { getPool, query } = require('../src/db/connection')
const { createGame, getGameState, saveNarrativeTurn } = require('../src/db/repositories/gameState.repository')
const { loadState } = require('../src/modules/gameEngine/gameEngine.service')
const { resolveTurn } = require('../src/modules/gameEngine/turnEngine.service')

loadEnvFile()

async function run() {
  const username = `idempotency_${Date.now()}`
  const account = await query("INSERT INTO accounts (username, email, role) VALUES (?, ?, 'player')", [username, `${username}@example.invalid`])
  try {
    const game = await createGame(account.insertId)
    const state = await getGameState(game.storyCycleId)
    const requestKey = crypto.randomUUID()
    const interpretation = { status: 'VALID', intent: 'explore', confidence: 1, validatedByEngine: true }
    const first = await resolveTurn(state, 'I carefully study the path.', interpretation, requestKey)
    const second = await resolveTurn(state, 'I carefully study the path.', interpretation, requestKey)
    assert.deepEqual(second, first)
    const advancedState = await getGameState(game.storyCycleId)
    assert.equal(Number(state.activeStoryBeat.beat_number), 1)
    assert.equal(Number(advancedState.activeStoryBeat.beat_number), 2)
    assert.equal(advancedState.lockedStoryBeats.some((beat) => Number(beat.beat_number) <= Number(advancedState.activeStoryBeat.beat_number)), false)
    const turns = await query('SELECT total_turns FROM story_progress WHERE story_cycle_id = ?', [game.storyCycleId])
    assert.equal(Number(turns[0].total_turns), 1)
    const requests = await query("SELECT COUNT(*) AS count FROM engine_turn_requests WHERE story_cycle_id = ? AND status = 'completed'", [game.storyCycleId])
    assert.equal(Number(requests[0].count), 1)
    const scene = { story: 'The path remains still.', choices: [], consequences: [{ engineResolution: first }], parsedIntent: interpretation, memorySignals: [], validationViolations: [] }
    const firstSave = await saveNarrativeTurn({ state, playerAction: 'I carefully study the path.', actionKind: 'typed', scene, requestKey })
    const secondSave = await saveNarrativeTurn({ state, playerAction: 'I carefully study the path.', actionKind: 'typed', scene, requestKey })
    assert.equal(secondSave.replayed, true)
    assert.equal(secondSave.playerMessageId, firstSave.playerMessageId)
    const messages = await query('SELECT COUNT(*) AS count FROM narrative_messages WHERE story_cycle_id = ? AND request_key = ?', [game.storyCycleId, requestKey])
    assert.equal(Number(messages[0].count), 2)
    const memories = await query('SELECT COUNT(*) AS count FROM story_memories WHERE story_cycle_id = ? AND memory_key = ?', [game.storyCycleId, `action-${requestKey}`])
    assert.equal(Number(memories[0].count), 1)
    const other = await query("INSERT INTO accounts (username, email, role) VALUES (?, ?, 'player')", [`other_${username}`, `other_${username}@example.invalid`])
    await assert.rejects(() => loadState(game.storyCycleId, other.insertId), /another player/)
    await query('DELETE FROM accounts WHERE id = ?', [other.insertId])
    console.log('Turn idempotency checks passed.')
  } finally {
    await query('DELETE FROM accounts WHERE id = ?', [account.insertId])
  }
}

run().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
}).finally(() => getPool().end())
