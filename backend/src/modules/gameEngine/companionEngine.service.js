function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function findNamed(action, records, field = 'name') {
  const text = action.toLowerCase()
  return records.find((record) => text.includes(String(record[field]).toLowerCase())) || records[0] || null
}

async function relationshipEvent(connection, companion, state, type, changes, summary, context = {}) {
  await connection.execute(
    `INSERT INTO companion_relationship_events (companion_id, story_cycle_id, event_type, trust_change, loyalty_change, fear_change, betrayal_change, summary, context_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [companion.id, state.run.id, type, changes.trust || 0, changes.loyalty || 0, changes.fear || 0, changes.betrayal || 0, summary, JSON.stringify(context)],
  )
}

async function preserveSoulMemory(connection, companion, state, type, summary, facts = {}) {
  if (!companion.world_npc_id) return
  await connection.execute(
    `INSERT INTO companion_reincarnation_memories (soul_profile_id, world_npc_id, source_story_cycle_id, memory_type, summary, emotional_weight, facts_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [state.run.soul_profile_id, companion.world_npc_id, state.run.id, type, summary, Math.max(1, Math.abs(Number(companion.loyalty || 0)) + Math.abs(Number(companion.betrayal || 0))), JSON.stringify(facts)],
  )
}

async function recruitNpc(connection, state, npc, result) {
  const personality = parseJson(npc.personality_json, {})
  const relationships = parseJson(npc.run_relationship_json || npc.relationship_with_player_json, {})
  const role = personality.companionRole
  if (!role) return
  await connection.execute(
    `INSERT INTO companions (world_npc_id, story_cycle_id, character_life_id, name, role_name, personality_json, secrets_json, relationship_state_json, advice_style, active, companion_status, trust, loyalty, fear, betrayal, hp, max_hp, attack_stat, defense_stat, speed_stat, combat_style_json, recruited_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, 1, 'active', ?, ?, ?, ?, 60, 60, 8, 6, 6, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE active = 1, companion_status = 'active', departed_at = NULL`,
    [npc.id, state.run.id, state.run.character_life_id, npc.name, role, JSON.stringify(personality), JSON.stringify(relationships), personality.speech || '', Number(relationships.trust || 0), Number(relationships.loyalty || 0), Number(relationships.fear || 0), Number(relationships.betrayal || 0), JSON.stringify({ role })],
  )
  await connection.execute("UPDATE cycle_npc_states SET recruitment_status = 'recruited' WHERE story_cycle_id = ? AND npc_id = ?", [state.run.id, npc.id])
  const [rows] = await connection.execute('SELECT * FROM companions WHERE story_cycle_id = ? AND world_npc_id = ?', [state.run.id, npc.id])
  await relationshipEvent(connection, rows[0], state, 'recruited', { trust: 5, loyalty: 5 }, `${npc.name} joined the journey.`)
  result.companions.push({ name: npc.name, status: 'recruited', role })
}

async function processCompanionAction(connection, state, action, signatures, result) {
  result.companions ||= []
  const text = action.toLowerCase()
  const candidates = state.activeNpcs.filter((npc) => parseJson(npc.personality_json, {}).companionRole)

  if (['recruit', 'join me', 'travel with me', 'come with me', 'invite'].some((word) => text.includes(word))) {
    const npc = findNamed(action, candidates)
    if (npc) await recruitNpc(connection, state, npc, result)
  }

  if (['reject', 'do not join', "don't join"].some((word) => text.includes(word))) {
    const npc = findNamed(action, candidates)
    if (npc) {
      await connection.execute("UPDATE cycle_npc_states SET recruitment_status = 'rejected' WHERE story_cycle_id = ? AND npc_id = ?", [state.run.id, npc.id])
      result.companions.push({ name: npc.name, status: 'rejected' })
    }
  }

  const [active] = await connection.execute("SELECT * FROM companions WHERE story_cycle_id = ? AND active = 1 AND companion_status IN ('active', 'injured')", [state.run.id])
  for (const companion of active) {
    const changes = { trust: 0, loyalty: 0, fear: 0, betrayal: 0 }
    if (signatures.some((value) => ['protect', 'heal', 'spare', 'befriend'].includes(value))) changes.trust += 3
    if (signatures.some((value) => ['protect', 'refuse_cruel_order'].includes(value))) changes.loyalty += 2
    if (signatures.includes('attack') && text.includes(companion.name.toLowerCase())) changes.fear += 15
    if (text.includes('betray') || (text.includes('abandon') && text.includes(companion.name.toLowerCase()))) changes.betrayal += 30
    if (Object.values(changes).some(Boolean)) {
      await connection.execute('UPDATE companions SET trust = LEAST(100, GREATEST(-100, trust + ?)), loyalty = LEAST(100, GREATEST(-100, loyalty + ?)), fear = LEAST(100, GREATEST(0, fear + ?)), betrayal = LEAST(100, GREATEST(0, betrayal + ?)) WHERE id = ?', [changes.trust, changes.loyalty, changes.fear, changes.betrayal, companion.id])
      await relationshipEvent(connection, companion, state, changes.betrayal ? 'betrayed' : changes.fear ? 'feared' : changes.loyalty ? 'loyal' : 'trusted', changes, `${companion.name} remembers how the player acted.`, { action, signatures })
      result.companions.push({ name: companion.name, status: 'relationship_changed', changes })
    }

    if (text.includes('leave') && text.includes(companion.name.toLowerCase())) {
      await connection.execute("UPDATE companions SET active = 0, companion_status = 'departed', departed_at = CURRENT_TIMESTAMP WHERE id = ?", [companion.id])
      await relationshipEvent(connection, companion, state, 'departed', {}, `${companion.name} left the journey.`, { action })
      await preserveSoulMemory(connection, companion, state, 'departure', `${companion.name} departed during Life ${state.run.life_number}.`, { trust: companion.trust, loyalty: companion.loyalty })
      result.companions.push({ name: companion.name, status: 'departed' })
    }
  }
}

async function closeCompanionsForDeath(connection, state) {
  const [companions] = await connection.execute('SELECT * FROM companions WHERE story_cycle_id = ? AND world_npc_id IS NOT NULL', [state.run.id])
  for (const companion of companions) {
    await preserveSoulMemory(connection, companion, state, companion.companion_status, `${companion.name} remembers the end of Life ${state.run.life_number}.`, { trust: companion.trust, loyalty: companion.loyalty, fear: companion.fear, betrayal: companion.betrayal })
  }
}

module.exports = { closeCompanionsForDeath, processCompanionAction }
