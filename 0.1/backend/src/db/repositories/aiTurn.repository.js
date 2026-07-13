const crypto = require('node:crypto')
const { withTransaction } = require('../connection')
const { initializeFloor } = require('../../modules/gameEngine/turnEngine.service')

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

async function applyTargetChange(connection, state, change) {
  if (change.type === 'monster') {
    const [rows] = await connection.execute('SELECT current_hp, max_hp, state_json FROM cycle_monster_states WHERE id = ? AND story_cycle_id = ? FOR UPDATE', [change.id, state.run.id])
    const current = rows[0]
    const hp = Number(current.current_hp) + change.hpDelta
    const targetState = parseJson(current.state_json, {})
    const statuses = new Set(Array.isArray(targetState.statuses) ? targetState.statuses : [])
    change.newStatuses.forEach((status) => statuses.add(status.key))
    change.removedStatuses.forEach((status) => statuses.delete(status.key))
    targetState.statuses = [...statuses]
    await connection.execute('UPDATE cycle_monster_states SET current_hp = ?, status = ?, state_json = ? WHERE id = ?', [hp, hp <= 0 ? 'defeated' : 'alive', JSON.stringify(targetState), change.id])
    await connection.execute("UPDATE combat_participants SET current_hp = ?, status = ? WHERE participant_type = 'monster' AND reference_id = ? AND combat_encounter_id IN (SELECT id FROM combat_encounters WHERE story_cycle_id = ? AND status = 'active')", [hp, hp <= 0 ? 'defeated' : 'active', change.id, state.run.id])
    return
  }
  if (change.type === 'boss') {
    const [rows] = await connection.execute('SELECT current_hp, encounter_state_json FROM cycle_boss_states WHERE story_cycle_id = ? AND boss_profile_id = ? FOR UPDATE', [state.run.id, change.id])
    const hp = Number(rows[0].current_hp) + change.hpDelta
    const bossState = parseJson(rows[0].encounter_state_json, {})
    const statuses = new Set(Array.isArray(bossState.statuses) ? bossState.statuses : [])
    change.newStatuses.forEach((status) => statuses.add(status.key))
    change.removedStatuses.forEach((status) => statuses.delete(status.key))
    bossState.statuses = [...statuses]
    await connection.execute("UPDATE cycle_boss_states SET current_hp = ?, status = IF(? <= 0, 'defeated', status), encounter_state_json = ?, defeated_at = IF(? <= 0, CURRENT_TIMESTAMP, defeated_at) WHERE story_cycle_id = ? AND boss_profile_id = ?", [hp, hp, JSON.stringify(bossState), hp, state.run.id, change.id])
    await connection.execute("UPDATE combat_participants SET current_hp = ?, status = ? WHERE participant_type = 'boss' AND reference_id = ? AND combat_encounter_id IN (SELECT id FROM combat_encounters WHERE story_cycle_id = ? AND status = 'active')", [hp, hp <= 0 ? 'defeated' : 'active', change.id, state.run.id])
    return
  }
  if (change.type === 'companion') {
    await connection.execute('UPDATE companions SET hp = hp + ?, companion_status = IF(hp + ? <= 0, \'dead\', companion_status) WHERE id = ? AND story_cycle_id = ?', [change.hpDelta, change.hpDelta, change.id, state.run.id])
  }
}

async function applyPlayerStatuses(connection, state, changes) {
  for (const status of changes.playerStatusesAdded) {
    const [catalog] = await connection.execute('SELECT id, default_duration_turns FROM status_effects WHERE status_key = ?', [status.key])
    const duration = status.duration === undefined ? catalog[0].default_duration_turns : status.duration
    const [existing] = await connection.execute('SELECT id FROM character_status_effects WHERE character_life_id = ? AND status_effect_id = ? AND removed_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE', [state.run.character_life_id, catalog[0].id])
    if (existing[0]) await connection.execute('UPDATE character_status_effects SET intensity = ?, remaining_turns = ? WHERE id = ?', [status.intensity, duration, existing[0].id])
    else await connection.execute("INSERT INTO character_status_effects (character_life_id, status_effect_id, source_type, intensity, remaining_turns, state_json) VALUES (?, ?, 'ai_game_master', ?, ?, '{}')", [state.run.character_life_id, catalog[0].id, status.intensity, duration])
  }
  for (const status of changes.playerStatusUpdates) {
    await connection.execute(`UPDATE character_status_effects cse JOIN status_effects se ON se.id = cse.status_effect_id
      SET cse.remaining_turns = ? WHERE cse.character_life_id = ? AND se.status_key = ? AND cse.removed_at IS NULL`, [status.remainingTurns, state.run.character_life_id, status.key])
  }
  for (const status of changes.playerStatusesRemoved) {
    await connection.execute(`UPDATE character_status_effects cse JOIN status_effects se ON se.id = cse.status_effect_id
      SET cse.remaining_turns = 0, cse.removed_at = CURRENT_TIMESTAMP WHERE cse.character_life_id = ? AND se.status_key = ? AND cse.removed_at IS NULL`, [state.run.character_life_id, status.key])
  }
}

async function applyItems(connection, state, changes) {
  for (const item of changes.itemsRemoved) {
    const [rows] = await connection.execute('SELECT id, quantity FROM character_inventory WHERE character_life_id = ? AND item_id = ? ORDER BY id LIMIT 1 FOR UPDATE', [state.run.character_life_id, item.id])
    const quantity = Number(rows[0].quantity) - item.quantity
    if (quantity) await connection.execute('UPDATE character_inventory SET quantity = ? WHERE id = ?', [quantity, rows[0].id])
    else await connection.execute('DELETE FROM character_inventory WHERE id = ?', [rows[0].id])
  }
  for (const item of changes.itemsAdded) {
    const [rows] = await connection.execute('SELECT id, quantity FROM character_inventory WHERE character_life_id = ? AND item_id = ? AND equipped_slot IS NULL ORDER BY id LIMIT 1 FOR UPDATE', [state.run.character_life_id, item.id])
    if (rows[0]) await connection.execute('UPDATE character_inventory SET quantity = quantity + ? WHERE id = ?', [item.quantity, rows[0].id])
    else await connection.execute("INSERT INTO character_inventory (character_life_id, item_id, quantity, equipped_slot, item_state_json) VALUES (?, ?, ?, NULL, '{}')", [state.run.character_life_id, item.id, item.quantity])
  }
}

async function applyRelationships(connection, state, changes) {
  for (const change of changes.relationshipChanges) {
    if (change.type === 'companion') {
      await connection.execute(`UPDATE companions SET trust = trust + ?, loyalty = loyalty + ?, fear = fear + ?, betrayal = betrayal + ? WHERE id = ? AND story_cycle_id = ?`, [change.trustDelta, change.loyaltyDelta, change.fearDelta, change.betrayalDelta, change.id, state.run.id])
    } else if (change.type === 'npc') {
      const [rows] = await connection.execute('SELECT relationship_json FROM cycle_npc_states WHERE story_cycle_id = ? AND npc_id = ? FOR UPDATE', [state.run.id, change.id])
      const relationship = parseJson(rows[0].relationship_json, {})
      relationship.trust = Number(relationship.trust || 0) + change.trustDelta
      relationship.loyalty = Number(relationship.loyalty || 0) + change.loyaltyDelta
      relationship.fear = Number(relationship.fear || 0) + change.fearDelta
      relationship.betrayal = Number(relationship.betrayal || 0) + change.betrayalDelta
      await connection.execute('UPDATE cycle_npc_states SET relationship_json = ? WHERE story_cycle_id = ? AND npc_id = ?', [JSON.stringify(relationship), state.run.id, change.id])
    }
  }
}

async function applyFloorState(connection, state, changes) {
  await connection.execute(
    'UPDATE floor_runtime_states SET scene_count = scene_count + 1, floor_complete = IF(?, 1, floor_complete), exit_unlocked = IF(?, 1, exit_unlocked), combat_completed = IF(?, 1, combat_completed) WHERE story_cycle_id = ? AND floor_id = ?',
    [changes.floorComplete ? 1 : 0, changes.exitUnlocked ? 1 : 0, changes.bossDefeated ? 1 : 0, state.run.id, state.run.current_floor_id],
  )
  if (changes.bossDefeated && Number(state.currentFloor.floor_number) === 3) {
    await connection.execute(`INSERT INTO cycle_dungeon_progress (story_cycle_id, dungeon_id, highest_floor, boss_defeated, completed_at)
      VALUES (?, ?, 3, 1, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE highest_floor = 3, boss_defeated = 1, completed_at = CURRENT_TIMESTAMP`, [state.run.id, state.currentDungeon.id])
  }
  if (!changes.floorChange) return

  await connection.execute("UPDATE floor_runtime_states SET status = 'cleared', cleared_at = CURRENT_TIMESTAMP WHERE story_cycle_id = ? AND floor_id = ?", [state.run.id, state.run.current_floor_id])
  const currentFloorNumber = Number(state.currentFloor.floor_number)
  const currentDungeonNumber = Number(state.currentDungeon.dungeon_number)
  if (currentFloorNumber === 3) {
    await connection.execute(`INSERT INTO cycle_dungeon_progress (story_cycle_id, dungeon_id, highest_floor, boss_defeated, completed_at)
      VALUES (?, ?, 3, 1, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE highest_floor = 3, boss_defeated = 1, completed_at = CURRENT_TIMESTAMP`, [state.run.id, state.currentDungeon.id])
  } else {
    await connection.execute('UPDATE cycle_dungeon_progress SET highest_floor = GREATEST(highest_floor, ?) WHERE story_cycle_id = ? AND dungeon_id = ?', [changes.floorChange.floorNumber, state.run.id, state.currentDungeon.id])
  }
  await connection.execute('UPDATE story_progress SET current_dungeon_id = ?, current_floor_id = ?, current_chapter = current_chapter + 1, current_scene = ? WHERE story_cycle_id = ?', [changes.floorChange.dungeonId, changes.floorChange.floorId, `floor-${changes.floorChange.floorNumber}-arrival`, state.run.id])
  await initializeFloor(connection, state, changes.floorChange.dungeonId, changes.floorChange.floorId)
  if (currentDungeonNumber !== Number(changes.floorChange.dungeonId)) await connection.execute('INSERT IGNORE INTO cycle_dungeon_progress (story_cycle_id, dungeon_id, highest_floor) VALUES (?, ?, 1)', [state.run.id, changes.floorChange.dungeonId])
}

async function ensureEncounter(connection, state, turn) {
  if (!['combat', 'boss'].includes(turn.sceneType) || !turn.actionResolution.targetType || !['monster', 'boss'].includes(turn.actionResolution.targetType)) return null
  let [encounters] = await connection.execute("SELECT * FROM combat_encounters WHERE story_cycle_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1 FOR UPDATE", [state.run.id])
  if (!encounters[0]) {
    const targetId = turn.actionResolution.targetId
    const type = turn.actionResolution.targetType === 'boss' ? 'boss' : 'monster'
    const [created] = await connection.execute(`INSERT INTO combat_encounters (story_cycle_id, character_life_id, floor_id, encounter_type, monster_state_id, boss_profile_id, state_json)
      VALUES (?, ?, ?, ?, ?, ?, '{}')`, [state.run.id, state.run.character_life_id, state.run.current_floor_id, type, type === 'monster' ? targetId : null, type === 'boss' ? targetId : null])
    ;[encounters] = await connection.execute('SELECT * FROM combat_encounters WHERE id = ?', [created.insertId])
  }
  const encounter = encounters[0]
  await connection.execute(`INSERT IGNORE INTO combat_participants (combat_encounter_id, participant_type, reference_id, display_name, team, current_hp, max_hp, attack_stat, defense_stat, speed_stat, resistances_json, weaknesses_json, state_json)
    VALUES (?, 'player', ?, ?, 'player', ?, ?, ?, ?, ?, '{}', '{}', '{}')`, [encounter.id, state.run.character_life_id, state.characterSheet.character_name, state.characterSheet.hp, state.characterSheet.max_hp, state.characterSheet.strength, state.characterSheet.defense, state.characterSheet.agility])
  for (const target of state.reachableTargets.filter((entry) => ['monster', 'boss'].includes(entry.type))) {
    await connection.execute(`INSERT IGNORE INTO combat_participants (combat_encounter_id, participant_type, reference_id, display_name, team, current_hp, max_hp, attack_stat, defense_stat, speed_stat, resistances_json, weaknesses_json, state_json)
      VALUES (?, ?, ?, ?, 'enemy', ?, ?, 1, 0, 1, '{}', '{}', '{}')`, [encounter.id, target.type, target.id, target.name, target.hp, target.maxHp])
  }
  return encounter
}

async function saveAcceptedTurn({ state, playerAction, actionKind, selectedTarget, requestKey, turn }) {
  const actionHash = crypto.createHash('sha256').update(JSON.stringify({ playerAction, selectedTarget: selectedTarget || null })).digest('hex')
  return withTransaction(async (connection) => {
    const [requests] = await connection.execute('SELECT action_hash, status, resolution_json FROM engine_turn_requests WHERE story_cycle_id = ? AND request_key = ? FOR UPDATE', [state.run.id, requestKey])
    if (requests[0]) {
      if (requests[0].action_hash !== actionHash) throw new Error('The requestKey was already used for a different action or target.')
      if (requests[0].status === 'completed') return { turn: parseJson(requests[0].resolution_json, turn), saved: { replayed: true } }
    } else {
      await connection.execute('INSERT INTO engine_turn_requests (story_cycle_id, character_life_id, request_key, action_hash) VALUES (?, ?, ?, ?)', [state.run.id, state.run.character_life_id, requestKey, actionHash])
    }

    const changes = turn.stateChanges
    await connection.execute(`UPDATE character_sheets SET hp = hp + ?, mana = mana + ?, stamina = stamina + ?, gold = gold + ?, xp = xp + ? WHERE character_life_id = ?`, [changes.playerHpDelta, changes.playerManaDelta, changes.playerStaminaDelta, changes.goldDelta, changes.playerXpDelta, state.run.character_life_id])
    if (changes.soulEnergyDelta) await connection.execute('UPDATE soul_profiles SET soul_energy = soul_energy + ? WHERE id = ?', [changes.soulEnergyDelta, state.run.soul_profile_id])
    const encounter = await ensureEncounter(connection, state, turn)
    if (encounter) await connection.execute("UPDATE combat_participants SET current_hp = ? WHERE combat_encounter_id = ? AND participant_type = 'player' AND reference_id = ?", [Number(state.characterSheet.hp) + changes.playerHpDelta, encounter.id, state.run.character_life_id])
    for (const target of changes.targets) await applyTargetChange(connection, state, target)
    await applyPlayerStatuses(connection, state, changes)
    await applyItems(connection, state, changes)
    for (const skill of changes.skillsAdded) await connection.execute('INSERT INTO character_skills (character_life_id, skill_id) VALUES (?, ?)', [state.run.character_life_id, skill.id])
    for (const quest of changes.questUpdates) await connection.execute('UPDATE cycle_quests SET status = ?, progress_json = ? WHERE story_cycle_id = ? AND quest_id = ?', [quest.status, JSON.stringify(quest.progress), state.run.id, quest.id])
    await applyRelationships(connection, state, changes)
    if (changes.bossDefeated && state.activeBoss) await connection.execute("UPDATE cycle_boss_states SET status = IF(current_hp <= 0, 'defeated', 'spared'), defeated_at = CURRENT_TIMESTAMP WHERE story_cycle_id = ? AND boss_profile_id = ?", [state.run.id, state.activeBoss.id])
    await applyFloorState(connection, state, changes)
    await connection.execute('UPDATE story_progress SET total_turns = total_turns + 1 WHERE story_cycle_id = ?', [state.run.id])

    if (encounter) {
      await connection.execute(`INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, actor_id, action_type, action_text, damage, healing, result_json)
        VALUES (?, ?, 'player', ?, ?, ?, ?, ?, ?)`, [encounter.id, encounter.round_number, state.run.character_life_id, turn.actionResolution.intent.toLowerCase(), playerAction, changes.targets.filter((target) => target.hpDelta < 0).reduce((sum, target) => sum + Math.abs(target.hpDelta), 0), Math.max(0, changes.playerHpDelta), JSON.stringify(turn.actionResolution)])
      const [remaining] = await connection.execute("SELECT COUNT(*) AS count FROM combat_participants WHERE combat_encounter_id = ? AND team = 'enemy' AND status = 'active'", [encounter.id])
      await connection.execute('UPDATE combat_encounters SET round_number = round_number + 1, status = IF(? = 0, \'victory\', status), ended_at = IF(? = 0, CURRENT_TIMESTAMP, ended_at) WHERE id = ?', [remaining[0].count, remaining[0].count, encounter.id])
    }

    if (changes.characterDied) {
      await connection.execute("UPDATE character_lives SET status = 'dead', death_scene = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?", [turn.story, state.run.character_life_id])
      await connection.execute("UPDATE story_cycles SET status = 'dead', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [state.run.id])
      await connection.execute('UPDATE soul_profiles SET total_deaths = total_deaths + 1 WHERE id = ?', [state.run.soul_profile_id])
    }

    const [playerMessage] = await connection.execute(`INSERT INTO narrative_messages (story_cycle_id, character_life_id, speaker, message_text, parsed_intent_json, request_key)
      VALUES (?, ?, 'player', ?, ?, ?)`, [state.run.id, state.run.character_life_id, playerAction, JSON.stringify(turn.actionResolution), requestKey])
    await connection.execute(`INSERT INTO choice_history (story_cycle_id, character_life_id, floor_id, action_text, action_kind, intent_json, outcome_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [state.run.id, state.run.character_life_id, state.run.current_floor_id, playerAction, actionKind, JSON.stringify(turn.actionResolution), JSON.stringify(turn.stateChanges)])
    const consequence = [{ acceptedTurn: turn }]
    const [narratorMessage] = await connection.execute(`INSERT INTO narrative_messages (story_cycle_id, character_life_id, speaker, message_text, choices_json, consequence_json, request_key)
      VALUES (?, ?, 'narrator', ?, ?, ?, ?)`, [state.run.id, state.run.character_life_id, turn.story, JSON.stringify(turn.choices), JSON.stringify(consequence), requestKey])
    await connection.execute(`INSERT INTO response_sections (narrative_message_id, story_text, character_changes_json, new_items_or_skills_json, choices_json, scene_type, narrative_sections_json, status_summary_json, story_opportunities_json, npc_introductions_json)
      VALUES (?, ?, ?, '[]', ?, ?, '{}', NULL, '[]', '[]')`, [narratorMessage.insertId, turn.story, JSON.stringify(turn.recordChanges), JSON.stringify(turn.choices), turn.sceneType])
    for (const [index, memory] of turn.memoryUpdates.entries()) await connection.execute(`INSERT INTO story_memories (soul_profile_id, story_cycle_id, character_life_id, scope, memory_key, summary, facts_json, importance, remembered_across_lives)
      VALUES (?, ?, ?, 'run', ?, ?, ?, 1, 0)`, [state.run.soul_profile_id, state.run.id, state.run.character_life_id, `ai-turn-${requestKey}-${index}`, memory.text, JSON.stringify({ type: memory.type, actionResolution: turn.actionResolution })])
    await connection.execute("UPDATE engine_turn_requests SET status = 'completed', resolution_json = ?, completed_at = CURRENT_TIMESTAMP WHERE story_cycle_id = ? AND request_key = ?", [JSON.stringify(turn), state.run.id, requestKey])
    return { turn, saved: { playerMessageId: playerMessage.insertId, narrativeMessageId: narratorMessage.insertId, replayed: false } }
  })
}

async function findAcceptedTurn(storyCycleId, requestKey, playerAction, selectedTarget) {
  const actionHash = crypto.createHash('sha256').update(JSON.stringify({ playerAction, selectedTarget: selectedTarget || null })).digest('hex')
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute("SELECT action_hash, resolution_json FROM engine_turn_requests WHERE story_cycle_id = ? AND request_key = ? AND status = 'completed'", [storyCycleId, requestKey])
    if (rows[0] && rows[0].action_hash !== actionHash) throw new Error('The requestKey was already used for a different action or target.')
    return rows[0] ? parseJson(rows[0].resolution_json, null) : null
  })
}

module.exports = { findAcceptedTurn, saveAcceptedTurn }
