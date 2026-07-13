const crypto = require('crypto')
const { withTransaction } = require('../../db/connection')
const { closeCompanionsForDeath, processCompanionAction } = require('./companionEngine.service')
const { processAdvancedSkills } = require('./advancedSkillEngine.service')

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function deriveActionSignatures(action) {
  const text = action.toLowerCase()
  const signatures = new Set()
  const rules = {
    attack: ['attack', 'strike', 'slash', 'stab', 'shoot', 'hit', 'fight'],
    bite: ['bite', 'fang', 'devour'],
    magic: ['spell', 'magic', 'mana', 'fire', 'flame', 'ice', 'lightning', 'curse'],
    defend: ['defend', 'block', 'brace', 'guard', 'shield'],
    dodge: ['dodge', 'evade', 'roll', 'sidestep'],
    heal: ['heal', 'bandage', 'medicine', 'restore', 'treat wound'],
    protect: ['protect', 'save', 'cover', 'stand between'],
    spare: ['spare', 'show mercy', 'do not kill', "don't kill"],
    flee: ['flee', 'escape', 'run away', 'retreat'],
    analyze: ['analyze', 'inspect', 'study', 'observe', 'weakness'],
    solve: ['solve', 'puzzle', 'decode', 'riddle'],
    negotiate: ['talk', 'ask', 'negotiate', 'persuade', 'reason', 'bargain'],
    befriend: ['befriend', 'friend', 'trust', 'comfort', 'feed'],
    hide: ['hide', 'sneak', 'shadow', 'quietly'],
    create: ['create', 'craft', 'build', 'shape', 'improvise'],
    consume: ['consume', 'devour', 'eat the defeated', 'absorb'],
    remember: ['remember', 'memory', 'previous life', 'soul echo'],
    refuse: ['refuse', 'reject', 'defy', 'say no'],
    explore: ['explore', 'search', 'open', 'enter', 'follow', 'climb', 'continue', 'advance', 'walk', 'move'],
  }
  for (const [signature, words] of Object.entries(rules)) {
    if (words.some((word) => text.includes(word))) signatures.add(signature)
  }
  if (signatures.has('protect') && text.includes('dragon')) signatures.add('protect_dragon')
  if (signatures.has('refuse') && text.includes('prophecy')) signatures.add('reject_prophecy')
  if (signatures.has('refuse') && (text.includes('cruel') || text.includes('order'))) signatures.add('refuse_cruel_order')
  if (signatures.has('refuse') && (text.includes('bargain') || text.includes('reward'))) signatures.add('refuse_bargain')
  if (text.includes('mercy')) signatures.add('show_mercy')
  if (text.includes('law')) signatures.add('challenge_law')
  if (text.includes('truth') || text.includes('confess')) signatures.add('confess_truth')
  if (text.includes('name') && signatures.has('remember')) signatures.add('restore_name')
  if (text.includes('false') && signatures.has('refuse')) signatures.add('reject_false_history')
  if (text.includes('habit') || text.includes('different')) signatures.add('break_habit')
  if (text.includes('imperfect')) signatures.add('accept_imperfect_self')
  if (text.includes('future')) signatures.add('protect_future')
  if (!signatures.size) signatures.add('creative_action')
  return [...signatures]
}

function actionTypeFrom(signatures, interpretation) {
  if (interpretation?.status === 'VALID' && interpretation.intent !== 'unknown') return interpretation.intent
  if (signatures.includes('flee')) return 'flee'
  if (signatures.includes('heal')) return 'heal'
  if (signatures.includes('defend')) return 'defend'
  if (signatures.includes('dodge')) return 'dodge'
  if (signatures.some((value) => ['attack', 'bite', 'magic'].includes(value))) return 'attack'
  if (signatures.some((value) => ['negotiate', 'befriend', 'spare'].includes(value))) return 'social'
  if (signatures.includes('analyze')) return 'analyze'
  return 'explore'
}

function evaluateActionCheck(state, actionType, interpretation = {}, roll = crypto.randomInt(1, 21)) {
  const statByAction = {
    social: 'charisma', analyze: 'intelligence', explore: 'agility', heal: 'resolve_stat',
    defend: 'resolve_stat', dodge: 'agility', flee: 'agility',
  }
  const statKey = statByAction[actionType]
  if (!statKey || actionType === 'defend' || actionType === 'dodge' || actionType === 'flee') return null
  const sheet = state.characterSheet
  const stat = Number(sheet[statKey] || 0)
  const level = Number(sheet.level || 1)
  const realmDifficulty = Number(state.currentDungeon?.difficulty_level || state.currentDungeon?.dungeon_number || 1)
  const injuryPenalty = (state.injuries || []).reduce((total, injury) => total + ({ minor: 1, moderate: 3, major: 5, critical: 8 }[injury.severity] || 0), 0)
  const statusPenalty = (state.statusEffects || []).length * 2
  const capabilityBonus = (interpretation?.requiredCapabilities || []).length ? 2 : 0
  const preparationBonus = (state.previousChoices || []).slice(0, 5).some((choice) => /prepare|study|analyze|plan/i.test(choice.action_text || '')) ? 2 : 0
  const total = stat * 2 + level * 2 + Number(roll) + capabilityBonus + preparationBonus - injuryPenalty - statusPenalty
  const difficulty = 20 + realmDifficulty * 3
  const margin = total - difficulty
  const outcome = margin >= 15 ? 'exceptional' : margin >= 0 ? 'success' : margin >= -8 ? 'partial' : 'failure'
  return { outcome, roll: Number(roll), stat: statKey, statValue: stat, difficulty, total, margin, modifiers: { capabilityBonus, preparationBonus, injuryPenalty, statusPenalty } }
}

function findUsedSkill(action, skills) {
  const text = action.toLowerCase()
  return skills.find((skill) => text.includes(skill.name.toLowerCase()) || text.includes(skill.skill_key.replaceAll('-', ' '))) || null
}

async function recordEngineEvent(connection, state, eventType, eventKey, payload) {
  await connection.execute(
    `INSERT INTO game_engine_events (story_cycle_id, character_life_id, floor_id, event_type, event_key, event_payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [state.run.id, state.run.character_life_id, state.run.current_floor_id, eventType, eventKey, JSON.stringify(payload)],
  )
}

async function recordProgression(connection, state, type, sourceType, sourceId, amount, summary, payload = {}) {
  await connection.execute(
    `INSERT INTO character_progression_events (character_life_id, story_cycle_id, event_type, source_type, source_id, amount, summary, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [state.run.character_life_id, state.run.id, type, sourceType, sourceId || null, amount, summary, JSON.stringify(payload)],
  )
}

async function grantProgression(connection, state, rewards, sourceType, sourceId, result) {
  const xpGain = Math.max(0, Number(rewards.xp || 0))
  const goldGain = Math.max(0, Number(rewards.gold || 0))
  const soulGain = Math.max(0, Number(rewards.soulEnergy || 0))

  if (goldGain) {
    await connection.execute('UPDATE character_sheets SET gold = gold + ? WHERE character_life_id = ?', [goldGain, state.run.character_life_id])
    await recordProgression(connection, state, 'gold', sourceType, sourceId, goldGain, `Gained ${goldGain} Gold.`)
    result.rewards.gold += goldGain
  }
  if (soulGain) {
    await connection.execute('UPDATE soul_profiles SET soul_energy = soul_energy + ? WHERE id = ?', [soulGain, state.run.soul_profile_id])
    await recordProgression(connection, state, 'soul_energy', sourceType, sourceId, soulGain, `The soul absorbed ${soulGain} Soul Energy.`)
    result.rewards.soulEnergy += soulGain
  }
  if (!xpGain) return

  const [rows] = await connection.execute('SELECT level, xp, xp_needed FROM character_sheets WHERE character_life_id = ? FOR UPDATE', [state.run.character_life_id])
  let level = Number(rows[0].level)
  let xp = Number(rows[0].xp) + xpGain
  let xpNeeded = Number(rows[0].xp_needed)
  let levelsGained = 0
  while (xp >= xpNeeded) {
    xp -= xpNeeded
    level += 1
    levelsGained += 1
    xpNeeded = Math.floor(100 * (1.35 ** (level - 1)))
  }
  await connection.execute(
    `UPDATE character_sheets SET level = ?, xp = ?, xp_needed = ?,
       max_hp = max_hp + ?, hp = LEAST(max_hp + ?, hp + ?),
       max_mana = max_mana + ?, mana = LEAST(max_mana + ?, mana + ?),
       max_stamina = max_stamina + ?, stamina = LEAST(max_stamina + ?, stamina + ?),
       strength = strength + ?, agility = agility + ?, defense = defense + ?, thaumaturgy = thaumaturgy + ?, resolve_stat = resolve_stat + ?
     WHERE character_life_id = ?`,
    [level, xp, xpNeeded, levelsGained * 10, levelsGained * 10, levelsGained * 10, levelsGained * 5, levelsGained * 5, levelsGained * 5, levelsGained * 6, levelsGained * 6, levelsGained * 6, levelsGained, levelsGained, levelsGained, levelsGained, levelsGained, state.run.character_life_id],
  )
  await recordProgression(connection, state, 'xp', sourceType, sourceId, xpGain, `Gained ${xpGain} XP.`)
  result.rewards.xp += xpGain
  if (levelsGained) {
    await recordProgression(connection, state, 'level_up', sourceType, sourceId, levelsGained, `Reached Level ${level}.`, { level })
    result.levelUp = { levelsGained, newLevel: level }
  }
}

async function awardCatalogItems(connection, state, itemNames, sourceType, sourceId, result) {
  for (const name of itemNames || []) {
    const [items] = await connection.execute('SELECT id, item_key, name FROM items WHERE LOWER(name) = LOWER(?) LIMIT 1', [name])
    const item = items[0]
    if (!item) continue
    const [existing] = await connection.execute('SELECT id FROM character_inventory WHERE character_life_id = ? AND item_id = ? AND equipped_slot IS NULL LIMIT 1', [state.run.character_life_id, item.id])
    if (existing[0]) {
      await connection.execute('UPDATE character_inventory SET quantity = quantity + 1 WHERE id = ?', [existing[0].id])
    } else {
      await connection.execute("INSERT INTO character_inventory (character_life_id, item_id, quantity, item_state_json) VALUES (?, ?, 1, '{}')", [state.run.character_life_id, item.id])
    }
    await recordProgression(connection, state, 'item', sourceType, sourceId, 1, `Obtained ${item.name}.`, { itemKey: item.item_key })
    result.itemsAwarded.push({ itemKey: item.item_key, name: item.name })
  }
}

async function awardSkillProgressByKey(connection, state, progressByKey, sourceType, sourceId, result) {
  for (const [skillKey, amountValue] of Object.entries(progressByKey || {})) {
    const [skills] = await connection.execute('SELECT * FROM skills WHERE skill_key = ?', [skillKey])
    const skill = skills[0]
    if (!skill) continue
    const amount = Math.max(1, Number(amountValue || 1))
    const contextHash = crypto.createHash('sha256').update(`${state.run.character_life_id}:${skill.id}:${sourceType}:${sourceId}`).digest('hex')
    await connection.execute(
      `INSERT IGNORE INTO skill_progress_events (character_life_id, skill_id, story_cycle_id, action_text, action_signature, context_hash, success_level, progress_amount, eligible, evidence_json)
       VALUES (?, ?, ?, ?, ?, ?, 'exceptional', ?, 1, ?)`,
      [state.run.character_life_id, skill.id, state.run.id, `${sourceType} reward`, `${sourceType}_reward`, contextHash, amount, JSON.stringify({ sourceType, sourceId, floorId: state.run.current_floor_id })],
    )
    const [counts] = await connection.execute('SELECT COALESCE(SUM(progress_amount), 0) AS progress FROM skill_progress_events WHERE character_life_id = ? AND skill_id = ? AND eligible = 1', [state.run.character_life_id, skill.id])
    const progress = Number(counts[0].progress)
    const threshold = rarityThreshold[skill.rarity] || 5
    result.skillProgress.push({ skillKey, name: skill.name, progress, required: threshold })
    if (skill.visibility !== 'hidden' && progress >= threshold) {
      const [inserted] = await connection.execute(
        `INSERT IGNORE INTO character_skills (character_life_id, skill_id, skill_level, skill_xp, xp_needed, unlocked, discovered_at, discovery_context_json, equipped)
         VALUES (?, ?, 1, 0, 100, 1, CURRENT_TIMESTAMP, ?, 0)`,
        [state.run.character_life_id, skill.id, JSON.stringify({ sourceType, sourceId })],
      )
      if (inserted.affectedRows) result.skillsUnlocked.push({ skillKey, name: skill.name, identityText: skill.identity_text })
    }
  }
}

const skillCandidates = {
  bite: ['blood-fang'],
  consume: ['devour', 'predator'],
  analyze: ['analyze', 'abyss-gaze'],
  defend: ['brace', 'absolute-focus'],
  dodge: ['predator-instinct', 'shadow-step'],
  hide: ['shadow-step', 'shadow-thread'],
  magic: ['mana-core', 'arcane-creation'],
  create: ['arcane-creation'],
  protect: ['absolute-focus', 'endless-will'],
  remember: ['reincarnation-instinct', 'soul-archive'],
  befriend: ['dragon-fear'],
}

const rarityThreshold = { common: 2, uncommon: 3, rare: 5, epic: 8, legendary: 12, mythic: 20 }

async function progressSkills(connection, state, action, signatures, successLevel, result) {
  if (!['success', 'exceptional'].includes(successLevel)) return
  const candidateKeys = [...new Set(signatures.flatMap((signature) => skillCandidates[signature] || []))]
  if (!candidateKeys.length) return

  for (const skillKey of candidateKeys) {
    const [skills] = await connection.execute('SELECT * FROM skills WHERE skill_key = ? LIMIT 1', [skillKey])
    const skill = skills[0]
    if (!skill || skill.visibility === 'hidden') continue
    const [owned] = await connection.execute('SELECT * FROM character_skills WHERE character_life_id = ? AND skill_id = ?', [state.run.character_life_id, skill.id])
    if (owned[0]) continue

    const normalizedAction = action.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
    const contextHash = crypto.createHash('sha256').update(`${state.run.character_life_id}:${skill.id}:${state.run.current_floor_id}:${normalizedAction}`).digest('hex')
    const [floorProgress] = await connection.execute("SELECT COUNT(*) AS count FROM skill_progress_events WHERE character_life_id = ? AND skill_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(evidence_json, '$.floorId')) = ? AND eligible = 1", [state.run.character_life_id, skill.id, String(state.run.current_floor_id)])
    if (Number(floorProgress[0].count) >= 2) continue
    const [inserted] = await connection.execute(
      `INSERT IGNORE INTO skill_progress_events (character_life_id, skill_id, story_cycle_id, action_text, action_signature, context_hash, success_level, progress_amount, eligible, evidence_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
      [state.run.character_life_id, skill.id, state.run.id, action, signatures[0], contextHash, successLevel, JSON.stringify({ signatures, floorId: state.run.current_floor_id })],
    )
    if (!inserted.affectedRows) continue
    const [counts] = await connection.execute("SELECT COALESCE(SUM(progress_amount), 0) AS progress FROM skill_progress_events WHERE character_life_id = ? AND skill_id = ? AND success_level IN ('success', 'exceptional')", [state.run.character_life_id, skill.id])
    const progress = Number(counts[0].progress)
    const threshold = rarityThreshold[skill.rarity] || 5
    result.skillProgress.push({ skillKey, name: skill.name, progress, required: threshold })

    if (progress >= threshold) {
      await connection.execute(
        `INSERT IGNORE INTO character_skills (character_life_id, skill_id, skill_level, skill_xp, xp_needed, unlocked, discovered_at, discovery_context_json, equipped)
         VALUES (?, ?, 1, 0, 100, 1, CURRENT_TIMESTAMP, ?, 0)`,
        [state.run.character_life_id, skill.id, JSON.stringify({ action, signatures, floorId: state.run.current_floor_id })],
      )
      await recordProgression(connection, state, 'skill_unlock', 'action', skill.id, 1, `Unlocked ${skill.name}.`, { skillKey })
      result.skillsUnlocked.push({ skillKey, name: skill.name, identityText: skill.identity_text })
    }
  }
}

async function useOwnedSkill(connection, state, skill, result) {
  if (!skill) return
  const [rows] = await connection.execute('SELECT skill_level, skill_xp, xp_needed FROM character_skills WHERE character_life_id = ? AND skill_id = (SELECT id FROM skills WHERE skill_key = ?)', [state.run.character_life_id, skill.skill_key])
  if (!rows[0]) return
  let level = Number(rows[0].skill_level)
  let xp = Number(rows[0].skill_xp) + 10
  let needed = Number(rows[0].xp_needed)
  if (xp >= needed) {
    xp -= needed
    level += 1
    needed = Math.floor(needed * 1.4)
  }
  await connection.execute(
    `UPDATE character_skills cs JOIN skills s ON s.id = cs.skill_id
        SET cs.skill_level = ?, cs.skill_xp = ?, cs.xp_needed = ?, cs.times_used = cs.times_used + 1, cs.last_used_at = CURRENT_TIMESTAMP
      WHERE cs.character_life_id = ? AND s.skill_key = ?`,
    [level, xp, needed, state.run.character_life_id, skill.skill_key],
  )
  result.skillUsed = { skillKey: skill.skill_key, name: skill.name, level, xp, xpNeeded: needed }
}

async function updateQuests(connection, state, signatures, result) {
  await connection.execute(
    `INSERT IGNORE INTO cycle_quests (story_cycle_id, quest_id, status, progress_json, choices_json)
     SELECT ?, id, 'available', '{}', '[]' FROM quests WHERE floor_id = ?`,
    [state.run.id, state.run.current_floor_id],
  )
  const [quests] = await connection.execute(
    `SELECT q.*, cq.status, cq.progress_json FROM cycle_quests cq JOIN quests q ON q.id = cq.quest_id
      WHERE cq.story_cycle_id = ? AND cq.status IN ('available', 'active')`,
    [state.run.id],
  )
  for (const quest of quests) {
    const objectives = parseJson(quest.objectives_json, {})
    const consequences = parseJson(quest.consequence_rules_json, {})
    const failure = (consequences.failureActions || []).some((signature) => signatures.includes(signature))
    if (failure) {
      await connection.execute("UPDATE cycle_quests SET status = 'failed', choices_json = ? WHERE story_cycle_id = ? AND quest_id = ?", [JSON.stringify(signatures), state.run.id, quest.id])
      result.quests.push({ key: quest.quest_key, name: quest.name, status: 'failed' })
      continue
    }
    const matched = (objectives.actionSignatures || []).filter((signature) => signatures.includes(signature))
    if (!matched.length) continue
    const progressState = parseJson(quest.progress_json, {})
    const progress = Number(progressState.progress || 0) + 1
    const required = Number(objectives.required || 1)
    const status = progress >= required ? 'completed' : 'active'
    await connection.execute('UPDATE cycle_quests SET status = ?, progress_json = ?, choices_json = ? WHERE story_cycle_id = ? AND quest_id = ?', [status, JSON.stringify({ progress, required, matched: [...new Set([...(progressState.matched || []), ...matched])] }), JSON.stringify(signatures), state.run.id, quest.id])
    result.quests.push({ key: quest.quest_key, name: quest.name, status, progress, required })
    if (status === 'completed') {
      const rewards = parseJson(quest.rewards_json, {})
      await grantProgression(connection, state, rewards, 'quest', quest.id, result)
      if (rewards.item) await awardCatalogItems(connection, state, [rewards.item], 'quest', quest.id, result)
      await awardSkillProgressByKey(connection, state, rewards.skillProgress, 'quest', quest.id, result)
    }
  }
}

async function updateStoryThreads(connection, state, result) {
  result.storyThreads ||= []
  const [threads] = await connection.execute('SELECT * FROM story_threads ORDER BY FIELD(priority, \'critical\', \'major\', \'standard\', \'minor\'), id')
  const [questRows] = await connection.execute('SELECT quest_id, status, progress_json FROM cycle_quests WHERE story_cycle_id = ?', [state.run.id])
  const questStates = new Map(questRows.map((row) => [Number(row.quest_id), row]))
  const [turnRows] = await connection.execute('SELECT total_turns FROM story_progress WHERE story_cycle_id = ?', [state.run.id])

  for (const thread of threads) {
    const locationIds = parseJson(thread.related_location_ids_json, []).map(Number)
    const questIds = parseJson(thread.related_quest_ids_json, []).filter(Boolean).map(Number)
    const relatedStates = questIds.map((id) => questStates.get(id)).filter(Boolean)
    const relevant = locationIds.includes(Number(state.run.current_floor_id)) || relatedStates.length > 0
    if (!relevant) continue
    const rules = parseJson(thread.completion_rules_json, {})
    const requiredCompleted = Number(rules.requiredCompleted || 1)
    const completedCount = relatedStates.filter((quest) => quest.status === 'completed').length
    const failedCount = relatedStates.filter((quest) => quest.status === 'failed').length
    const requirements = parseJson(thread.requirements_json, {})
    const itemRequirements = Array.isArray(requirements.items) ? requirements.items : []
    const ownedItems = new Map((state.inventory || []).map((item) => [item.item_key, Number(item.quantity)]))
    const missingItems = itemRequirements.filter((requirement) => Number(ownedItems.get(requirement.key) || 0) < Number(requirement.quantity || 1))
    let status = completedCount >= requiredCompleted ? 'COMPLETED' : missingItems.length ? 'WAITING_FOR_REQUIREMENT' : relatedStates.some((quest) => quest.status === 'active') ? 'ACTIVE' : 'DISCOVERED'
    if (questIds.length && failedCount === questIds.length) status = 'FAILED'
    await connection.execute(
      `INSERT INTO cycle_story_threads (story_cycle_id, story_thread_id, status, introduced_at_turn, progress_json, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = IF(status IN ('COMPLETED','FAILED'), status, VALUES(status)), progress_json = VALUES(progress_json), resolved_at = COALESCE(resolved_at, VALUES(resolved_at))`,
      [state.run.id, thread.id, status, Number(turnRows[0]?.total_turns || 0), JSON.stringify({ completedQuestCount: completedCount, requiredCompleted, missingItems, relatedQuestIds: questIds }), ['COMPLETED', 'FAILED'].includes(status) ? new Date() : null],
    )
    result.storyThreads.push({ key: thread.thread_key, title: thread.title, status, completedQuestCount: completedCount, requiredCompleted, missingItems })
  }
}

async function updateFactionReputation(connection, state, signatures, result) {
  result.reputation ||= []
  const positive = signatures.some((signature) => ['protect', 'spare', 'heal', 'befriend', 'show_mercy', 'negotiate'].includes(signature))
  const negative = signatures.some((signature) => ['refuse_cruel_order'].includes(signature)) ? 0 : signatures.some((signature) => ['cruelty', 'betray_ally', 'harm_hatchling'].includes(signature)) ? -3 : 0
  const delta = positive ? 1 : negative
  if (!delta) return
  const [factions] = await connection.execute('SELECT id, faction_key, name FROM factions WHERE dungeon_id = ?', [state.currentDungeon.id])
  if (!factions[0]) return
  await connection.execute(
    `INSERT INTO cycle_faction_reputation (story_cycle_id, faction_id, reputation, standing, reasons_json)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE reputation = GREATEST(-100, LEAST(100, reputation + VALUES(reputation))),
       standing = CASE WHEN reputation + VALUES(reputation) >= 60 THEN 'honored' WHEN reputation + VALUES(reputation) >= 25 THEN 'trusted' WHEN reputation + VALUES(reputation) <= -60 THEN 'hated' WHEN reputation + VALUES(reputation) <= -25 THEN 'hostile' WHEN reputation + VALUES(reputation) < 0 THEN 'wary' ELSE 'neutral' END,
       reasons_json = VALUES(reasons_json)`,
    [state.run.id, factions[0].id, delta, delta > 0 ? 'neutral' : 'wary', JSON.stringify({ lastSignatures: signatures, floorId: state.run.current_floor_id })],
  )
  const [updated] = await connection.execute('SELECT reputation, standing FROM cycle_faction_reputation WHERE story_cycle_id = ? AND faction_id = ?', [state.run.id, factions[0].id])
  result.reputation.push({ factionKey: factions[0].faction_key, name: factions[0].name, change: delta, reputation: updated[0].reputation, standing: updated[0].standing })
}

async function processWorldEvents(connection, state, signatures, result) {
  result.events ||= []
  await connection.execute(
    `INSERT IGNORE INTO cycle_events (story_cycle_id, world_event_id, status, state_json)
     SELECT ?, id, 'available', '{}' FROM world_events WHERE floor_id = ?`,
    [state.run.id, state.run.current_floor_id],
  )
  const [events] = await connection.execute(
    `SELECT we.*, ce.status, ce.state_json FROM cycle_events ce JOIN world_events we ON we.id = ce.world_event_id
      WHERE ce.story_cycle_id = ? AND ce.status IN ('available', 'triggered')`,
    [state.run.id],
  )
  for (const event of events) {
    const triggers = parseJson(event.trigger_rules_json, {})
    let matches = (triggers.signatures || []).filter((signature) => signatures.includes(signature)).length
    if (triggers.quest) {
      const [quests] = await connection.execute(`SELECT cq.status FROM cycle_quests cq JOIN quests q ON q.id = cq.quest_id WHERE cq.story_cycle_id = ? AND q.quest_key = ?`, [state.run.id, triggers.quest])
      if (quests[0]?.status === triggers.status) matches = Number(triggers.required || 1)
    }
    const stateData = parseJson(event.state_json, {})
    const progress = Number(stateData.progress || 0) + matches
    const required = Number(triggers.required || Math.max(1, (triggers.signatures || []).length))
    if (!matches) continue
    const complete = progress >= required
    await connection.execute('UPDATE cycle_events SET status = ?, state_json = ?, triggered_at = COALESCE(triggered_at, CURRENT_TIMESTAMP), completed_at = ? WHERE story_cycle_id = ? AND world_event_id = ?', [complete ? 'completed' : 'triggered', JSON.stringify({ progress, required, signatures }), complete ? new Date() : null, state.run.id, event.id])
    result.events.push({ key: event.event_key, name: event.name, status: complete ? 'completed' : 'triggered', progress, required })
    if (!complete) continue
    const outcomes = parseJson(event.outcomes_json, {})
    await grantProgression(connection, state, { gold: outcomes.gold, soulEnergy: outcomes.soulEnergy }, 'event', event.id, result)
    if (outcomes.item) await awardCatalogItems(connection, state, [outcomes.item], 'event', event.id, result)
    await awardSkillProgressByKey(connection, state, outcomes.skillProgress, 'event', event.id, result)
    if (outcomes.companionCandidate) {
      await connection.execute("UPDATE cycle_npc_states cns JOIN world_npcs n ON n.id = cns.npc_id SET cns.recruitment_status = 'candidate' WHERE cns.story_cycle_id = ? AND n.name = ?", [state.run.id, outcomes.companionCandidate])
    }
    if (outcomes.achievement) {
      await connection.execute(
        `INSERT IGNORE INTO character_achievements (character_life_id, story_cycle_id, achievement_key, name, description, evidence_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [state.run.character_life_id, state.run.id, outcomes.achievement, event.name, event.description, JSON.stringify({ eventKey: event.event_key })],
      )
    }
  }
}

async function getOrStartEncounter(connection, state, actionType) {
  const [active] = await connection.execute("SELECT * FROM combat_encounters WHERE story_cycle_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [state.run.id])
  if (active[0]) return active[0]
  if (!['attack', 'social', 'analyze', 'defend', 'dodge'].includes(actionType)) return null

  const isBossFloor = state.currentFloor.floor_type === 'boss'
  if (isBossFloor) {
    const legacyId = Number(state.currentDungeon.dungeon_number) === 10 ? state.previousLegacyHero?.id || null : null
    const boss = state.activeBoss
    if (!boss && !legacyId) return null
    const maxHp = legacyId
      ? Number(state.previousLegacyHero.character_snapshot_json?.hp || 500)
      : 30 + (Number(state.currentDungeon.dungeon_number) * 15)
    if (boss) {
      await connection.execute("UPDATE cycle_boss_states SET status = 'alive', current_hp = COALESCE(current_hp, ?), max_hp = COALESCE(max_hp, ?) WHERE story_cycle_id = ? AND boss_profile_id = ?", [maxHp, maxHp, state.run.id, boss.id])
    }
    const [created] = await connection.execute(
      `INSERT INTO combat_encounters (story_cycle_id, character_life_id, floor_id, encounter_type, boss_profile_id, legacy_hero_id, state_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [state.run.id, state.run.character_life_id, state.run.current_floor_id, legacyId ? 'legacy_boss' : 'boss', boss?.id || null, legacyId, JSON.stringify({ maxHp })],
    )
    const [rows] = await connection.execute('SELECT * FROM combat_encounters WHERE id = ?', [created.insertId])
    return rows[0]
  }

  const [monsters] = await connection.execute(
    `SELECT ms.* FROM cycle_monster_states ms WHERE ms.story_cycle_id = ? AND ms.current_floor_id = ? AND ms.status = 'alive' ORDER BY ms.id LIMIT 1`,
    [state.run.id, state.run.current_floor_id],
  )
  if (!monsters[0]) return null
  const [created] = await connection.execute(
    `INSERT INTO combat_encounters (story_cycle_id, character_life_id, floor_id, encounter_type, monster_state_id, state_json)
     VALUES (?, ?, ?, 'monster', ?, '{}')`,
    [state.run.id, state.run.character_life_id, state.run.current_floor_id, monsters[0].id],
  )
  const [rows] = await connection.execute('SELECT * FROM combat_encounters WHERE id = ?', [created.insertId])
  return rows[0]
}

function calculateEscapeChance({ agility, stamina, pursuit, statuses = [], boss = false }) {
  const activeStatuses = new Set(statuses)
  const mobilityPenalty = activeStatuses.has('frozen') ? 35 : activeStatuses.has('bleeding') || activeStatuses.has('poisoned') ? 10 : 0
  const bossPenalty = boss ? 25 : 0
  return Math.max(5, Math.min(90, 45 + Number(agility) * 2 + Number(stamina) * 0.2 - Number(pursuit) * 1.5 - mobilityPenalty - bossPenalty))
}

async function attemptEscape(connection, state, encounter, result) {
  const sheet = state.characterSheet
  const [enemyRows] = await connection.execute(
    `SELECT cp.attack_stat, cp.state_json FROM combat_participants cp WHERE cp.combat_encounter_id = ? AND cp.team = 'enemy' AND cp.status = 'active'`,
    [encounter.id],
  )
  const enemies = enemyRows.map((enemy) => ({ ...enemy, state_json: parseJson(enemy.state_json, {}) }))
  const pursuit = enemies.reduce((total, enemy) => total + Number(enemy.state_json.speed || enemy.attack_stat || 5), 0) / Math.max(1, enemies.length)
  const chance = calculateEscapeChance({
    agility: sheet.agility,
    stamina: sheet.stamina,
    pursuit,
    statuses: (state.statusEffects || []).map((effect) => effect.status_key),
    boss: encounter.encounter_type === 'boss' || encounter.encounter_type === 'legacy_boss',
  })
  const roll = crypto.randomInt(1, 101)
  const escaped = roll <= chance
  result.combat.escape = { escaped, chance: Math.round(chance), roll, pursued: !escaped }
  if (escaped) {
    await connection.execute("UPDATE combat_encounters SET status = 'escaped', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
    result.combat.status = 'escaped'
  } else {
    result.combat.status = 'active'
  }
  await connection.execute(
    `INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, actor_id, action_type, action_text, result_json)
     VALUES (?, ?, 'player', ?, 'flee', 'Attempts to escape.', ?)`,
    [encounter.id, encounter.round_number, state.run.character_life_id, JSON.stringify(result.combat.escape)],
  )
  return escaped
}

async function resolveCombat(connection, state, encounter, action, actionType, signatures, usedSkill, result) {
  if (!encounter) return false
  result.combat = { encounterId: encounter.id, type: encounter.encounter_type, round: encounter.round_number }
  if (actionType === 'flee') {
    await attemptEscape(connection, state, encounter, result)
    return false
  }
  if (actionType === 'social' && signatures.some((value) => ['spare', 'befriend', 'negotiate'].includes(value)) && encounter.encounter_type === 'monster') {
    await connection.execute("UPDATE combat_encounters SET status = 'resolved_peacefully', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
    await connection.execute("UPDATE cycle_monster_states SET status = 'friendly' WHERE id = ?", [encounter.monster_state_id])
    result.combat.status = 'resolved_peacefully'
    result.floorProgressGain += 2
    return true
  }

  const sheet = state.characterSheet
  let playerDamage = 0
  let healing = 0
  if (actionType === 'heal') healing = Math.max(5, Number(sheet.resolve_stat) + Number(sheet.level) * 2)
  if (actionType === 'attack') {
    const magic = signatures.includes('magic')
    const base = magic ? Number(sheet.thaumaturgy) : Number(sheet.strength)
    const skillBonus = usedSkill ? Number(usedSkill.skill_level || 1) * 3 : 0
    playerDamage = Math.max(1, base + Number(sheet.level) * 2 + skillBonus)
  }
  if (healing) {
    await connection.execute('UPDATE character_sheets SET hp = LEAST(max_hp, hp + ?) WHERE character_life_id = ?', [healing, state.run.character_life_id])
  }

  let enemyHp = 0
  let enemyAttack = 0
  let enemyName = 'Enemy'
  if (encounter.encounter_type === 'monster') {
    const [targets] = await connection.execute(`SELECT ms.*, wm.name, wm.stats_json FROM cycle_monster_states ms JOIN world_monsters wm ON wm.id = ms.monster_id WHERE ms.id = ? FOR UPDATE`, [encounter.monster_state_id])
    const target = targets[0]
    enemyHp = Number(target.current_hp) - playerDamage
    enemyAttack = Number(parseJson(target.stats_json, {}).attack || 6)
    enemyName = target.name
    await connection.execute('UPDATE cycle_monster_states SET current_hp = GREATEST(0, ?) WHERE id = ?', [enemyHp, target.id])
  } else if (encounter.legacy_hero_id) {
    const [legacyRows] = await connection.execute('SELECT hero_name, character_snapshot_json FROM legacy_heroes WHERE id = ?', [encounter.legacy_hero_id])
    const legacy = legacyRows[0]
    const snapshot = parseJson(legacy.character_snapshot_json, {})
    const encounterState = parseJson(encounter.state_json, {})
    enemyHp = Number(encounterState.currentHp || encounterState.maxHp || snapshot.hp || 500) - playerDamage
    enemyAttack = Number(snapshot.stats?.strength || 20) + Number(snapshot.level || 1)
    enemyName = legacy.hero_name
    encounterState.currentHp = Math.max(0, enemyHp)
    await connection.execute('UPDATE combat_encounters SET state_json = ? WHERE id = ?', [JSON.stringify(encounterState), encounter.id])
  } else {
    const [bossRows] = await connection.execute(`SELECT bs.*, bp.boss_name FROM cycle_boss_states bs JOIN boss_profiles bp ON bp.id = bs.boss_profile_id WHERE bs.story_cycle_id = ? AND bs.boss_profile_id = ? FOR UPDATE`, [state.run.id, encounter.boss_profile_id])
    const boss = bossRows[0]
    enemyHp = Number(boss.current_hp) - playerDamage
    enemyAttack = 3 + Number(state.currentDungeon.dungeon_number)
    enemyName = boss.boss_name
    await connection.execute('UPDATE cycle_boss_states SET current_hp = GREATEST(0, ?) WHERE story_cycle_id = ? AND boss_profile_id = ?', [enemyHp, state.run.id, encounter.boss_profile_id])
  }

  await connection.execute(
    `INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, actor_id, action_type, action_text, damage, healing, result_json)
     VALUES (?, ?, 'player', ?, ?, ?, ?, ?, ?)`,
    [encounter.id, encounter.round_number, state.run.character_life_id, actionType, action, playerDamage, healing, JSON.stringify({ signatures, enemyName, enemyHp: Math.max(0, enemyHp) })],
  )
  result.combat.playerDamage = playerDamage
  result.combat.enemyName = enemyName
  result.combat.enemyHp = Math.max(0, enemyHp)

  if (enemyHp <= 0) {
    await connection.execute("UPDATE combat_encounters SET status = 'victory', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
    if (encounter.encounter_type === 'monster') {
      const [rewardRows] = await connection.execute("SELECT cms.xp_reward, cms.gold_reward, wm.loot_json FROM cycle_monster_states cms JOIN world_monsters wm ON wm.id = cms.monster_id WHERE cms.id = ?", [encounter.monster_state_id])
      await connection.execute("UPDATE cycle_monster_states SET status = 'defeated', current_hp = 0 WHERE id = ?", [encounter.monster_state_id])
      await grantProgression(connection, state, { xp: rewardRows[0].xp_reward, gold: rewardRows[0].gold_reward }, 'monster', encounter.monster_state_id, result)
      await awardCatalogItems(connection, state, parseJson(rewardRows[0].loot_json, []), 'monster', encounter.monster_state_id, result)
    } else {
      if (encounter.boss_profile_id) await connection.execute("UPDATE cycle_boss_states SET status = 'defeated', current_hp = 0, defeated_at = CURRENT_TIMESTAMP WHERE story_cycle_id = ? AND boss_profile_id = ?", [state.run.id, encounter.boss_profile_id])
      await grantProgression(connection, state, { xp: 100 + Number(state.currentDungeon.dungeon_number) * 50, gold: 50 + Number(state.currentDungeon.dungeon_number) * 25, soulEnergy: 10 * Number(state.currentDungeon.dungeon_number) }, 'boss', encounter.boss_profile_id || encounter.legacy_hero_id, result)
      if (encounter.boss_profile_id) {
        const [bossRewards] = await connection.execute('SELECT mechanics_json FROM boss_profiles WHERE id = ?', [encounter.boss_profile_id])
        await awardCatalogItems(connection, state, parseJson(bossRewards[0]?.mechanics_json, {}).rewards || [], 'boss', encounter.boss_profile_id, result)
      }
    }
    result.combat.status = 'victory'
    result.floorProgressGain += 3
    return true
  }

  const reduction = actionType === 'defend' ? 0.35 : actionType === 'dodge' ? 0.55 : 1
  const enemyDamage = Math.max(1, Math.floor((enemyAttack - Number(sheet.defense) * 0.5) * reduction))
  await connection.execute('UPDATE character_sheets SET hp = GREATEST(0, hp - ?) WHERE character_life_id = ?', [enemyDamage, state.run.character_life_id])
  await connection.execute(
    `INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, action_type, action_text, damage, result_json)
     VALUES (?, ?, ?, 'counterattack', ?, ?, ?)`,
    [encounter.id, encounter.round_number, encounter.encounter_type === 'monster' ? 'monster' : 'boss', `${enemyName} counterattacks.`, enemyDamage, JSON.stringify({ target: state.run.character_life_id })],
  )
  await connection.execute('UPDATE combat_encounters SET round_number = round_number + 1 WHERE id = ?', [encounter.id])
  result.combat.enemyDamage = enemyDamage
  result.combat.status = 'active'
  return false
}

async function useConsumable(connection, state, action, result) {
  const [consumables] = await connection.execute(
    `SELECT ci.id AS inventory_id, ci.quantity, i.id AS item_id, i.item_key, i.name, i.effects_json
       FROM character_inventory ci JOIN items i ON i.id = ci.item_id
      WHERE ci.character_life_id = ? AND i.item_type = 'consumable' AND ci.quantity > 0`,
    [state.run.character_life_id],
  )
  const text = action.toLowerCase()
  const item = consumables.find((entry) => text.includes(entry.name.toLowerCase()) || text.includes(entry.item_key.replaceAll('-', ' ')))
  if (!item) return false
  const effects = parseJson(item.effects_json, {})
  await connection.execute('UPDATE character_sheets SET hp = LEAST(max_hp, hp + ?), mana = LEAST(max_mana, mana + ?) WHERE character_life_id = ?', [Number(effects.heal || 0), Number(effects.manaRestore || 0), state.run.character_life_id])
  for (const statusKey of effects.statusRemove || []) {
    await connection.execute(`UPDATE character_status_effects cse JOIN status_effects se ON se.id = cse.status_effect_id SET cse.removed_at = CURRENT_TIMESTAMP WHERE cse.character_life_id = ? AND se.status_key = ? AND cse.removed_at IS NULL`, [state.run.character_life_id, statusKey])
  }
  if (Number(item.quantity) <= 1) await connection.execute('DELETE FROM character_inventory WHERE id = ?', [item.inventory_id])
  else await connection.execute('UPDATE character_inventory SET quantity = quantity - 1 WHERE id = ?', [item.inventory_id])
  result.consumableUsed = { itemKey: item.item_key, name: item.name, healing: Number(effects.heal || 0), mana: Number(effects.manaRestore || 0) }
  return true
}

async function equipmentBonuses(connection, characterLifeId) {
  const [equipment] = await connection.execute(
    `SELECT i.effects_json, es.bonuses_json, es.durability
       FROM character_inventory ci JOIN items i ON i.id = ci.item_id
       LEFT JOIN equipment_states es ON es.character_inventory_id = ci.id
      WHERE ci.character_life_id = ? AND ci.equipped_slot IS NOT NULL`,
    [characterLifeId],
  )
  return equipment.reduce((total, row) => {
    if (row.durability !== null && Number(row.durability) <= 0) return total
    const effects = { ...parseJson(row.effects_json, {}), ...parseJson(row.bonuses_json, {}) }
    total.attack += Number(effects.attack || 0)
    total.defense += Number(effects.defense || 0)
    total.magic += Number(effects.thaumaturgy || effects.magic || 0)
    return total
  }, { attack: 0, defense: 0, magic: 0 })
}

async function ensureCombatParticipants(connection, state, encounter) {
  await connection.execute(
    `INSERT IGNORE INTO combat_participants (combat_encounter_id, participant_type, reference_id, display_name, team, current_hp, max_hp, attack_stat, defense_stat, speed_stat, resistances_json, weaknesses_json, state_json)
     VALUES (?, 'player', ?, ?, 'player', ?, ?, ?, ?, ?, '{}', '{}', '{}')`,
    [encounter.id, state.run.character_life_id, state.characterSheet.character_name, state.characterSheet.hp, state.characterSheet.max_hp, state.characterSheet.strength, state.characterSheet.defense, state.characterSheet.agility],
  )
  if (encounter.encounter_type === 'monster') {
    const [monsters] = await connection.execute(
      `SELECT cms.id, cms.current_hp, cms.max_hp, wm.name, wm.stats_json
         FROM cycle_monster_states cms JOIN world_monsters wm ON wm.id = cms.monster_id
        WHERE cms.story_cycle_id = ? AND cms.current_floor_id = ? AND cms.status = 'alive'`,
      [state.run.id, state.run.current_floor_id],
    )
    for (const monster of monsters) {
      const stats = parseJson(monster.stats_json, {})
      await connection.execute(
        `INSERT IGNORE INTO combat_participants (combat_encounter_id, participant_type, reference_id, display_name, team, current_hp, max_hp, attack_stat, defense_stat, speed_stat, resistances_json, weaknesses_json, state_json)
         VALUES (?, 'monster', ?, ?, 'enemy', ?, ?, ?, ?, ?, ?, ?, '{}')`,
        [encounter.id, monster.id, monster.name, monster.current_hp, monster.max_hp, Number(stats.attack || 6), Number(stats.defense || 3), Number(stats.speed || 5), JSON.stringify(stats.resistances || {}), JSON.stringify(stats.weaknesses || {})],
      )
    }
  } else if (encounter.legacy_hero_id) {
    const [rows] = await connection.execute('SELECT hero_name, character_snapshot_json, skills_snapshot_json, equipment_snapshot_json, combat_style_snapshot_json, boss_snapshot_json FROM legacy_heroes WHERE id = ?', [encounter.legacy_hero_id])
    const snapshot = parseJson(rows[0].character_snapshot_json, {})
    const style = parseJson(rows[0].combat_style_snapshot_json, {})
    const legacySkills = parseJson(rows[0].skills_snapshot_json, [])
    const bossSnapshot = parseJson(rows[0].boss_snapshot_json, {})
    const preferredSkills = parseJson(style.preferred_skills_json, {})
    const signatureSkill = Object.entries(preferredSkills).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || legacySkills.sort((a, b) => Number(b.times_used || 0) - Number(a.times_used || 0))[0]?.name || null
    await connection.execute(
      `INSERT IGNORE INTO combat_participants (combat_encounter_id, participant_type, reference_id, display_name, team, current_hp, max_hp, attack_stat, defense_stat, speed_stat, resistances_json, weaknesses_json, state_json)
       VALUES (?, 'legacy_boss', ?, ?, 'enemy', ?, ?, ?, ?, ?, '{}', '{}', ?)`,
      [encounter.id, encounter.legacy_hero_id, rows[0].hero_name, Number(snapshot.hp || 200), Number(snapshot.hp || 200), Math.max(Number(snapshot.stats?.strength || 20), Number(snapshot.stats?.thaumaturgy || 0)), Number(snapshot.stats?.defense || 15), Number(snapshot.stats?.agility || 10), JSON.stringify({ phase: 1, legacyStyle: style, signatureSkill, bossSnapshot, healed: false })],
    )
  } else {
    const [bosses] = await connection.execute(`SELECT bs.current_hp, bs.max_hp, bp.boss_name, bp.mechanics_json FROM cycle_boss_states bs JOIN boss_profiles bp ON bp.id = bs.boss_profile_id WHERE bs.story_cycle_id = ? AND bs.boss_profile_id = ?`, [state.run.id, encounter.boss_profile_id])
    const boss = bosses[0]
    const mechanics = parseJson(boss.mechanics_json, {})
    await connection.execute(
      `INSERT IGNORE INTO combat_participants (combat_encounter_id, participant_type, reference_id, display_name, team, current_hp, max_hp, attack_stat, defense_stat, speed_stat, resistances_json, weaknesses_json, state_json)
       VALUES (?, 'boss', ?, ?, 'enemy', ?, ?, ?, ?, ?, '{}', '{}', ?)`,
      [encounter.id, encounter.boss_profile_id, boss.boss_name, boss.current_hp, boss.max_hp, 3 + Number(state.currentDungeon.dungeon_number), 5 + Number(state.currentDungeon.dungeon_number), 5 + Number(state.currentDungeon.dungeon_number), JSON.stringify({ phase: 1, mechanics })],
    )
  }
  const [companions] = await connection.execute("SELECT * FROM companions WHERE story_cycle_id = ? AND active = 1 AND companion_status IN ('active', 'injured') AND hp > 0", [state.run.id])
  for (const companion of companions) {
    await connection.execute(
      `INSERT IGNORE INTO combat_participants (combat_encounter_id, participant_type, reference_id, display_name, team, current_hp, max_hp, attack_stat, defense_stat, speed_stat, resistances_json, weaknesses_json, state_json)
       VALUES (?, 'companion', ?, ?, 'player', ?, ?, ?, ?, ?, '{}', '{}', ?)`,
      [encounter.id, companion.id, companion.name, companion.hp, companion.max_hp, companion.attack_stat, companion.defense_stat, companion.speed_stat, JSON.stringify({ role: companion.role_name })],
    )
  }
  const [participants] = await connection.execute("SELECT * FROM combat_participants WHERE combat_encounter_id = ? AND status = 'active' ORDER BY speed_stat DESC, id", [encounter.id])
  return participants.map((row) => ({ ...row, resistances_json: parseJson(row.resistances_json, {}), weaknesses_json: parseJson(row.weaknesses_json, {}), state_json: parseJson(row.state_json, {}) }))
}

function damageMultiplier(target, damageType) {
  const resistance = Number(target.resistances_json?.[damageType] || 0)
  const weakness = Number(target.weaknesses_json?.[damageType] || 0)
  return Math.max(0.1, 1 - resistance + weakness)
}

function bossWeaknessMultiplier(target, action) {
  const weaknesses = target.state_json?.mechanics?.weaknesses || []
  const words = action.toLowerCase()
  return weaknesses.some((weakness) => String(weakness).toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 3).some((word) => words.includes(word))) ? 1.35 : 1
}

async function syncParticipant(connection, state, participant, hp, status = 'active') {
  await connection.execute('UPDATE combat_participants SET current_hp = ?, status = ? WHERE id = ?', [Math.max(0, hp), status, participant.id])
  if (participant.participant_type === 'player') await connection.execute('UPDATE character_sheets SET hp = ? WHERE character_life_id = ?', [Math.max(0, hp), state.run.character_life_id])
  if (participant.participant_type === 'monster') await connection.execute('UPDATE cycle_monster_states SET current_hp = ?, status = ? WHERE id = ?', [Math.max(0, hp), status === 'defeated' ? 'defeated' : 'alive', participant.reference_id])
  if (participant.participant_type === 'boss') await connection.execute('UPDATE cycle_boss_states SET current_hp = ?, status = ? WHERE story_cycle_id = ? AND boss_profile_id = ?', [Math.max(0, hp), status === 'defeated' ? 'defeated' : 'alive', state.run.id, participant.reference_id])
  if (participant.participant_type === 'companion') await connection.execute('UPDATE companions SET hp = ?, companion_status = ? WHERE id = ?', [Math.max(0, hp), status === 'dead' ? 'dead' : hp < participant.max_hp * 0.3 ? 'injured' : 'active', participant.reference_id])
}

async function applyEnemyStatus(connection, state, enemy, target) {
  if (target.participant_type !== 'player' || enemy.participant_type !== 'monster') return null
  const [rows] = await connection.execute(`SELECT wm.behavior_json FROM cycle_monster_states cms JOIN world_monsters wm ON wm.id = cms.monster_id WHERE cms.id = ?`, [enemy.reference_id])
  const statusKey = parseJson(rows[0]?.behavior_json, {}).statusOnHit
  if (!statusKey) return null
  const [effects] = await connection.execute('SELECT id, default_duration_turns FROM status_effects WHERE status_key = ?', [statusKey])
  if (!effects[0]) return null
  await connection.execute(
    `INSERT INTO character_status_effects (character_life_id, status_effect_id, source_type, source_id, intensity, remaining_turns, state_json)
     VALUES (?, ?, 'monster', ?, 1, ?, '{}')`,
    [state.run.character_life_id, effects[0].id, enemy.reference_id, effects[0].default_duration_turns],
  )
  return statusKey
}

async function resolveMultiCombat(connection, state, encounter, action, actionType, signatures, usedSkill, result) {
  if (!encounter) return false
  const participants = await ensureCombatParticipants(connection, state, encounter)
  const player = participants.find((entry) => entry.participant_type === 'player')
  let enemies = participants.filter((entry) => entry.team === 'enemy')
  const companions = participants.filter((entry) => entry.participant_type === 'companion')
  const target = enemies.find((entry) => action.toLowerCase().includes(entry.display_name.toLowerCase())) || enemies.sort((a, b) => a.current_hp - b.current_hp)[0]
  if (!target) return false
  result.combat = { encounterId: encounter.id, type: encounter.encounter_type, round: encounter.round_number, target: target.display_name, enemies: enemies.map((entry) => ({ name: entry.display_name, hp: entry.current_hp, maxHp: entry.max_hp })) }
  if (actionType === 'flee' && await attemptEscape(connection, state, encounter, result)) return false

  if (actionType === 'social' && result.successLevel !== 'failure' && signatures.some((value) => ['spare', 'befriend', 'negotiate'].includes(value)) && target.participant_type === 'monster') {
    await syncParticipant(connection, state, target, target.current_hp, 'spared')
    enemies = enemies.filter((entry) => entry.id !== target.id)
    result.combat.status = enemies.length ? 'active' : 'resolved_peacefully'
    if (!enemies.length) await connection.execute("UPDATE combat_encounters SET status = 'resolved_peacefully', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
    result.floorProgressGain += enemies.length ? 1 : 2
    return !enemies.length
  }

  const bonuses = await equipmentBonuses(connection, state.run.character_life_id)
  const damageType = signatures.includes('magic') ? (action.toLowerCase().includes('fire') ? 'fire' : 'magic') : 'physical'
  let playerDamage = 0
  if (actionType === 'attack') {
    const base = damageType === 'physical' ? Number(state.characterSheet.strength) + bonuses.attack : Number(state.characterSheet.thaumaturgy) + bonuses.magic
    playerDamage = Math.max(1, Math.floor((base + Number(state.characterSheet.level) * 2 + (usedSkill ? Number(usedSkill.skill_level || 1) * 3 : 0) - Number(target.defense_stat) * 0.35) * damageMultiplier(target, damageType) * bossWeaknessMultiplier(target, action)))
  }
  if (actionType === 'heal') {
    const healing = Math.max(5, Number(state.characterSheet.resolve_stat) + Number(state.characterSheet.level) * 2)
    player.current_hp = Math.min(player.max_hp, player.current_hp + healing)
    await syncParticipant(connection, state, player, player.current_hp)
    result.combat.healing = healing
  }
  target.current_hp -= playerDamage
  await connection.execute(`INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, actor_id, action_type, action_text, damage, result_json) VALUES (?, ?, 'player', ?, ?, ?, ?, ?)`, [encounter.id, encounter.round_number, state.run.character_life_id, actionType, action, playerDamage, JSON.stringify({ target: target.display_name, damageType })])

  for (const companion of companions) {
    if (target.current_hp <= 0) break
    const role = companion.state_json?.role
    if (role === 'healer' && player.current_hp < player.max_hp * 0.5) {
      const healing = Math.max(5, Math.floor(companion.attack_stat * 0.8))
      player.current_hp = Math.min(player.max_hp, player.current_hp + healing)
      await syncParticipant(connection, state, player, player.current_hp)
      result.companionActions ||= []
      result.companionActions.push({ name: companion.display_name, action: 'heal', healing })
    } else {
      const damage = Math.max(1, Math.floor(companion.attack_stat - target.defense_stat * 0.3))
      target.current_hp -= damage
      result.companionActions ||= []
      result.companionActions.push({ name: companion.display_name, action: 'attack', target: target.display_name, damage })
      await connection.execute(`INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, actor_id, action_type, action_text, damage, result_json) VALUES (?, ?, 'companion', ?, 'attack', ?, ?, ?)`, [encounter.id, encounter.round_number, companion.reference_id, `${companion.display_name} attacks ${target.display_name}.`, damage, JSON.stringify({ target: target.id })])
    }
  }

  result.combat.playerDamage = playerDamage
  result.combat.enemyName = target.display_name
  result.combat.enemyHp = Math.max(0, target.current_hp)
  if (target.current_hp <= 0) {
    await syncParticipant(connection, state, target, 0, 'defeated')
    if (target.participant_type === 'monster') {
      const [rewardRows] = await connection.execute(`SELECT cms.xp_reward, cms.gold_reward, wm.loot_json FROM cycle_monster_states cms JOIN world_monsters wm ON wm.id = cms.monster_id WHERE cms.id = ?`, [target.reference_id])
      await grantProgression(connection, state, { xp: rewardRows[0].xp_reward, gold: rewardRows[0].gold_reward }, 'monster', target.reference_id, result)
      await awardCatalogItems(connection, state, parseJson(rewardRows[0].loot_json, []), 'monster', target.reference_id, result)
    }
    enemies = enemies.filter((entry) => entry.id !== target.id)
    if (!enemies.length) {
      await connection.execute("UPDATE combat_encounters SET status = 'victory', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
      if (target.participant_type !== 'monster') {
        if (target.participant_type === 'boss') await connection.execute("UPDATE cycle_boss_states SET status = 'defeated', defeated_at = CURRENT_TIMESTAMP WHERE story_cycle_id = ? AND boss_profile_id = ?", [state.run.id, target.reference_id])
        await grantProgression(connection, state, { xp: 100 + Number(state.currentDungeon.dungeon_number) * 50, gold: 50 + Number(state.currentDungeon.dungeon_number) * 25, soulEnergy: 10 * Number(state.currentDungeon.dungeon_number) }, 'boss', target.reference_id, result)
        if (target.participant_type === 'boss') {
          const [bossRewards] = await connection.execute('SELECT mechanics_json FROM boss_profiles WHERE id = ?', [target.reference_id])
          await awardCatalogItems(connection, state, parseJson(bossRewards[0]?.mechanics_json, {}).rewards || [], 'boss', target.reference_id, result)
        }
      }
      result.combat.status = 'victory'
      result.floorProgressGain += 3
      return true
    }
  } else {
    await syncParticipant(connection, state, target, target.current_hp)
  }

  const playerDefense = Number(state.characterSheet.defense) + bonuses.defense
  for (const enemy of enemies) {
    if (enemy.participant_type === 'legacy_boss') {
      const thresholds = enemy.state_json?.legacyStyle?.combat_rhythm_json
        ? parseJson(enemy.state_json.legacyStyle.combat_rhythm_json, {}).healingThresholds || []
        : []
      const healThreshold = thresholds.length ? thresholds.reduce((sum, value) => sum + Number(value), 0) / thresholds.length : 0.25
      if (!enemy.state_json.healed && enemy.current_hp / enemy.max_hp <= healThreshold) {
        const healing = Math.max(10, Math.floor(enemy.max_hp * 0.18))
        enemy.current_hp = Math.min(enemy.max_hp, enemy.current_hp + healing)
        enemy.state_json.healed = true
        await connection.execute('UPDATE combat_participants SET current_hp = ?, state_json = ? WHERE id = ?', [enemy.current_hp, JSON.stringify(enemy.state_json), enemy.id])
        await connection.execute(`INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, actor_id, action_type, action_text, healing, result_json) VALUES (?, ?, 'boss', ?, 'heal', ?, ?, ?)`, [encounter.id, encounter.round_number, enemy.reference_id, `${enemy.display_name} heals at the same threshold used in their former life.`, healing, JSON.stringify({ signatureSkill: enemy.state_json.signatureSkill })])
        result.enemyActions ||= []
        result.enemyActions.push({ name: enemy.display_name, action: 'heal', healing, signatureSkill: enemy.state_json.signatureSkill })
        continue
      }
    }
    const possibleTargets = [player, ...companions.filter((entry) => entry.current_hp > 0)]
    const enemyTarget = possibleTargets[(Number(encounter.round_number) + Number(enemy.id)) % possibleTargets.length]
    const reduction = enemyTarget.participant_type === 'player' && actionType === 'defend' ? 0.4 : enemyTarget.participant_type === 'player' && actionType === 'dodge' ? 0.6 : 1
    const defense = enemyTarget.participant_type === 'player' ? playerDefense : enemyTarget.defense_stat
    const damage = Math.max(1, Math.floor((Number(enemy.attack_stat) - defense * 0.45) * reduction))
    enemyTarget.current_hp -= damage
    await syncParticipant(connection, state, enemyTarget, enemyTarget.current_hp, enemyTarget.current_hp <= 0 ? (enemyTarget.participant_type === 'companion' ? 'dead' : 'defeated') : 'active')
    if (enemyTarget.participant_type === 'companion' && enemyTarget.current_hp <= enemyTarget.max_hp * 0.3) {
      const dead = enemyTarget.current_hp <= 0
      await connection.execute(
        `INSERT INTO companion_injuries (companion_id, combat_encounter_id, name, severity, effects_json)
         SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM companion_injuries WHERE companion_id = ? AND healed_at IS NULL AND name = ?)`,
        [enemyTarget.reference_id, encounter.id, dead ? 'Fatal Battle Wound' : 'Severe Battle Wound', dead ? 'critical' : 'major', JSON.stringify({ combatPenalty: dead ? 1 : 0.25 }), enemyTarget.reference_id, dead ? 'Fatal Battle Wound' : 'Severe Battle Wound'],
      )
      const [companionRows] = await connection.execute('SELECT * FROM companions WHERE id = ?', [enemyTarget.reference_id])
      const companion = companionRows[0]
      await connection.execute(
        `INSERT INTO companion_relationship_events (companion_id, story_cycle_id, event_type, summary, context_json)
         VALUES (?, ?, ?, ?, ?)`,
        [companion.id, state.run.id, dead ? 'died' : 'injured', dead ? `${companion.name} died in battle.` : `${companion.name} was seriously injured.`, JSON.stringify({ encounterId: encounter.id, enemy: enemy.display_name })],
      )
      if (dead && companion.world_npc_id) {
        await connection.execute(
          `INSERT INTO companion_reincarnation_memories (soul_profile_id, world_npc_id, source_story_cycle_id, memory_type, summary, emotional_weight, facts_json)
           VALUES (?, ?, ?, 'death', ?, 100, ?)`,
          [state.run.soul_profile_id, companion.world_npc_id, state.run.id, `${companion.name} died beside the player during Life ${state.run.life_number}.`, JSON.stringify({ encounterId: encounter.id })],
        )
      }
    }
    if (enemyTarget.participant_type === 'player' && damage > 0) {
      await connection.execute(`UPDATE equipment_states es JOIN character_inventory ci ON ci.id = es.character_inventory_id SET es.durability = GREATEST(0, es.durability - 1) WHERE ci.character_life_id = ? AND ci.equipped_slot IS NOT NULL`, [state.run.character_life_id])
    }
    const status = await applyEnemyStatus(connection, state, enemy, enemyTarget)
    await connection.execute(`INSERT INTO combat_action_logs (combat_encounter_id, round_number, actor_type, actor_id, action_type, action_text, damage, result_json) VALUES (?, ?, ?, ?, 'attack', ?, ?, ?)`, [encounter.id, encounter.round_number, enemy.participant_type === 'monster' ? 'monster' : 'boss', enemy.reference_id, `${enemy.display_name} attacks ${enemyTarget.display_name}.`, damage, JSON.stringify({ target: enemyTarget.id, status })])
    result.enemyActions ||= []
    result.enemyActions.push({ name: enemy.display_name, target: enemyTarget.display_name, damage, status, skill: enemy.state_json?.signatureSkill || null })
  }

  if (target.participant_type === 'boss' || target.participant_type === 'legacy_boss') {
    const ratio = Math.max(0, target.current_hp) / target.max_hp
    const phase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1
    if (phase !== Number(target.state_json?.phase || 1)) {
      target.state_json.phase = phase
      await connection.execute('UPDATE combat_participants SET attack_stat = attack_stat + 2, state_json = ? WHERE id = ?', [JSON.stringify(target.state_json), target.id])
      const phaseName = target.state_json?.mechanics?.phases?.[phase - 1] || `Phase ${phase}`
      result.combat.phaseTransition = { phase, name: phaseName }
    }
  }
  await connection.execute('UPDATE combat_encounters SET round_number = round_number + 1 WHERE id = ?', [encounter.id])
  result.combat.status = 'active'
  result.combat.remainingEnemies = enemies.map((entry) => entry.display_name)
  return false
}

async function tickStatusEffects(connection, state, result) {
  const [statuses] = await connection.execute(
    `SELECT cse.id, cse.intensity, cse.remaining_turns, se.status_key, se.effects_json
       FROM character_status_effects cse JOIN status_effects se ON se.id = cse.status_effect_id
      WHERE cse.character_life_id = ? AND cse.removed_at IS NULL`,
    [state.run.character_life_id],
  )
  result.statusChanges ||= []
  for (const status of statuses) {
    const effects = parseJson(status.effects_json, {})
    const damage = effects.damageOverTime ? Math.max(1, Number(status.intensity) * 2) : 0
    if (damage) {
      await connection.execute('UPDATE character_sheets SET hp = GREATEST(0, hp - ?) WHERE character_life_id = ?', [damage, state.run.character_life_id])
      result.statusChanges.push({ status: status.status_key, damage })
    }
    if (status.remaining_turns !== null) {
      const remaining = Number(status.remaining_turns) - 1
      await connection.execute('UPDATE character_status_effects SET remaining_turns = ?, removed_at = ? WHERE id = ?', [Math.max(0, remaining), remaining <= 0 ? new Date() : null, status.id])
      if (remaining <= 0) result.statusChanges.push({ status: status.status_key, removed: true })
    }
  }
}

async function initializeFloor(connection, state, dungeonId, floorId) {
  const [floorRows] = await connection.execute('SELECT floor_type, purpose_type FROM dungeon_floors WHERE id = ?', [floorId])
  const floor = floorRows[0]
  const [threatRows] = await connection.execute('SELECT COUNT(*) AS count FROM world_monsters WHERE habitat_floor_id = ?', [floorId])
  const encounterRequired = floor.floor_type === 'boss' || Number(threatRows[0].count) > 0
  const decisionRequired = ['puzzle', 'mystery', 'npc_decision', 'moral_decision', 'quiet'].includes(floor.purpose_type)
  await connection.execute(
    `INSERT INTO floor_runtime_states (story_cycle_id, floor_id, status, objective_required, combat_required, entered_at, state_json)
     VALUES (?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, ?)
     ON DUPLICATE KEY UPDATE status = IF(status = 'cleared', status, 'active'), combat_required = VALUES(combat_required), state_json = VALUES(state_json), entered_at = COALESCE(entered_at, CURRENT_TIMESTAMP)`,
    [state.run.id, floorId, floor.floor_type === 'boss' ? 1 : 3, encounterRequired ? 1 : 0, JSON.stringify({ decisionRequired, purposeType: floor.purpose_type })],
  )
  await connection.execute(
    `INSERT IGNORE INTO cycle_npc_states (story_cycle_id, npc_id, current_floor_id, relationship_json, dialogue_state_json)
     SELECT ?, id, ?, '{}', '{}' FROM world_npcs WHERE current_floor_id = ?`,
    [state.run.id, floorId, floorId],
  )
  await connection.execute(
    `UPDATE cycle_npc_states cns JOIN world_npcs n ON n.id = cns.npc_id
        SET cns.recruitment_status = 'candidate'
      WHERE cns.story_cycle_id = ? AND cns.current_floor_id = ?
        AND JSON_EXTRACT(n.personality_json, '$.companionRole') IS NOT NULL
        AND cns.recruitment_status = 'unavailable'`,
    [state.run.id, floorId],
  )
  await connection.execute(
    `INSERT INTO cycle_monster_states (story_cycle_id, monster_id, current_floor_id, current_hp, max_hp, xp_reward, gold_reward, state_json)
     SELECT ?, wm.id, ?, COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(wm.stats_json, '$.hp')) AS UNSIGNED), 20),
            COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(wm.stats_json, '$.hp')) AS UNSIGNED), 20),
            10 + COALESCE(wm.habitat_dungeon_id, 1) * 8, 5 + COALESCE(wm.habitat_dungeon_id, 1) * 4, '{}'
       FROM world_monsters wm
      WHERE wm.habitat_floor_id = ?
        AND NOT EXISTS (SELECT 1 FROM cycle_monster_states cms WHERE cms.story_cycle_id = ? AND cms.monster_id = wm.id AND cms.current_floor_id = ?)`,
    [state.run.id, floorId, floorId, state.run.id, floorId],
  )
  await connection.execute(
    `INSERT IGNORE INTO cycle_quests (story_cycle_id, quest_id, status, progress_json, choices_json)
     SELECT ?, id, 'available', '{}', '[]' FROM quests WHERE floor_id = ?`,
    [state.run.id, floorId],
  )
  if (floor.floor_type === 'boss') {
    await connection.execute("UPDATE cycle_boss_states bs JOIN boss_profiles bp ON bp.id = bs.boss_profile_id SET bs.status = 'alive', bs.current_hp = COALESCE(bs.current_hp, 30 + ? * 15), bs.max_hp = COALESCE(bs.max_hp, 30 + ? * 15) WHERE bs.story_cycle_id = ? AND bp.dungeon_floor_id = ?", [dungeonId, dungeonId, state.run.id, floorId])
  }
}

function evaluateFloorGate({ runtime, runtimeState, bossFloor, activeBoss, result, progress }) {
  const savedBossVictory = bossFloor && ((activeBoss?.current_hp !== null && activeBoss?.current_hp !== undefined && Number(activeBoss.current_hp) <= 0)
    || ['defeated', 'spared'].includes(activeBoss?.status)
    || Boolean(activeBoss?.encounter_state_json?.nonCombatVictory))
  const encounterCompleted = Boolean(runtime.combat_completed) || (bossFloor
    ? result.combat?.status === 'victory' || savedBossVictory
    : ['victory', 'resolved_peacefully', 'escaped'].includes(result.combat?.status))
  const decisionSignatures = new Set(['solve', 'analyze', 'remember', 'create', 'negotiate', 'befriend', 'protect', 'spare', 'refuse', 'heal', 'show_mercy', 'challenge_law', 'confess_truth'])
  const decisionCompleted = Boolean(runtime.story_decision_completed) || (!runtimeState.decisionRequired ? true : result.signatures.some((signature) => decisionSignatures.has(signature)))
  const encounterOngoing = result.combat?.status === 'active'
  const ready = progress >= Number(runtime.objective_required) && (!runtime.combat_required || encounterCompleted) && decisionCompleted && !encounterOngoing
  return { encounterCompleted, decisionCompleted, encounterOngoing, ready }
}

async function advanceFloorIfReady(connection, state, result) {
  const [runtimeRows] = await connection.execute('SELECT * FROM floor_runtime_states WHERE story_cycle_id = ? AND floor_id = ? FOR UPDATE', [state.run.id, state.run.current_floor_id])
  const runtime = runtimeRows[0]
  if (!runtime) return
  const progress = Math.min(Number(runtime.objective_required), Number(runtime.objective_progress) + result.floorProgressGain)
  const runtimeState = parseJson(runtime.state_json, {})
  const bossFloor = state.currentFloor.floor_type === 'boss'
  const { encounterCompleted, decisionCompleted, ready } = evaluateFloorGate({ runtime, runtimeState, bossFloor, activeBoss: state.activeBoss, result, progress })
  await connection.execute('UPDATE floor_runtime_states SET scene_count = scene_count + 1, objective_progress = ?, combat_completed = ?, story_decision_completed = ? WHERE story_cycle_id = ? AND floor_id = ?', [progress, encounterCompleted ? 1 : 0, decisionCompleted ? 1 : 0, state.run.id, state.run.current_floor_id])
  result.floor = {
    progress,
    required: Number(runtime.objective_required),
    encounterRequired: Boolean(runtime.combat_required),
    encounterCompleted: Boolean(encounterCompleted),
    decisionRequired: Boolean(runtimeState.decisionRequired),
    decisionCompleted: Boolean(decisionCompleted),
    ready,
  }
  if (!ready) return

  await connection.execute("UPDATE floor_runtime_states SET status = 'cleared', cleared_at = CURRENT_TIMESTAMP WHERE story_cycle_id = ? AND floor_id = ?", [state.run.id, state.run.current_floor_id])
  await recordProgression(connection, state, 'floor_clear', 'floor', state.run.current_floor_id, 1, `Cleared ${state.currentFloor.floor_name}.`)
  const dungeonNumber = Number(state.currentDungeon.dungeon_number)
  const floorNumber = Number(state.currentFloor.floor_number)

  if (floorNumber < 5) {
    const nextFloorId = dungeonNumber * 100 + floorNumber + 1
    await connection.execute('UPDATE story_progress SET current_floor_id = ?, current_chapter = current_chapter + 1, current_scene = ? WHERE story_cycle_id = ?', [nextFloorId, `floor-${floorNumber + 1}-arrival`, state.run.id])
    await connection.execute('UPDATE cycle_dungeon_progress SET highest_floor = GREATEST(highest_floor, ?) WHERE story_cycle_id = ? AND dungeon_id = ?', [floorNumber + 1, state.run.id, state.currentDungeon.id])
    await initializeFloor(connection, state, dungeonNumber, nextFloorId)
    result.advanced = { type: 'floor', dungeon: dungeonNumber, floor: floorNumber + 1, floorId: nextFloorId }
    return
  }

  await connection.execute(
    `INSERT INTO cycle_dungeon_progress (story_cycle_id, dungeon_id, highest_floor, boss_defeated, completed_at)
     VALUES (?, ?, 5, 1, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE highest_floor = 5, boss_defeated = 1, completed_at = CURRENT_TIMESTAMP`,
    [state.run.id, state.currentDungeon.id],
  )
  await recordProgression(connection, state, 'realm_clear', 'dungeon', state.currentDungeon.id, 1, `Completed Realm ${dungeonNumber}: ${state.currentDungeon.name}.`)
  if (dungeonNumber === 10) {
    result.runCompleted = true
    return
  }
  const nextDungeon = dungeonNumber + 1
  const nextFloorId = nextDungeon * 100 + 1
  await connection.execute('UPDATE character_sheets SET hp = max_hp, mana = max_mana, stamina = max_stamina, health_condition = \'Healthy\' WHERE character_life_id = ?', [state.run.character_life_id])
  await connection.execute('UPDATE story_progress SET current_dungeon_id = ?, current_floor_id = ?, current_chapter = current_chapter + 1, current_scene = ? WHERE story_cycle_id = ?', [nextDungeon, nextFloorId, `realm-${nextDungeon}-arrival`, state.run.id])
  await connection.execute('INSERT IGNORE INTO cycle_dungeon_progress (story_cycle_id, dungeon_id, highest_floor) VALUES (?, ?, 1)', [state.run.id, nextDungeon])
  await initializeFloor(connection, state, nextDungeon, nextFloorId)
  result.advanced = { type: 'realm', dungeon: nextDungeon, floor: 1, floorId: nextFloorId }
}

async function updateBehavior(connection, state, action, actionType, signatures, usedSkill) {
  const caution = ['defend', 'dodge', 'analyze'].includes(actionType) ? 1 : 0
  const reckless = actionType === 'attack' ? 1 : 0
  const mercy = signatures.some((value) => ['spare', 'protect', 'heal', 'befriend'].includes(value)) ? 1 : 0
  const [profiles] = await connection.execute('SELECT favorite_weapons_json, preferred_skills_json, combat_rhythm_json, decision_style_json FROM player_behavior_profiles WHERE character_life_id = ? FOR UPDATE', [state.run.character_life_id])
  const profile = profiles[0] || {}
  const skillCounts = parseJson(profile.preferred_skills_json, {})
  const weaponCounts = parseJson(profile.favorite_weapons_json, {})
  const rhythm = parseJson(profile.combat_rhythm_json, { sequence: [], healingThresholds: [], targetPreferences: {} })
  if (usedSkill) skillCounts[usedSkill.name] = Number(skillCounts[usedSkill.name] || 0) + 1
  for (const weapon of ['sword', 'dagger', 'bow', 'staff', 'claw', 'fang', 'fist']) if (action.toLowerCase().includes(weapon)) weaponCounts[weapon] = Number(weaponCounts[weapon] || 0) + 1
  rhythm.sequence = [...(rhythm.sequence || []), actionType].slice(-30)
  if (actionType === 'heal') rhythm.healingThresholds = [...(rhythm.healingThresholds || []), Number(state.characterSheet.hp) / Math.max(1, Number(state.characterSheet.max_hp))].slice(-10)
  const decisionStyle = { ...parseJson(profile.decision_style_json, {}), lastActionType: actionType, lastSignatures: signatures, openingAction: parseJson(profile.decision_style_json, {}).openingAction || actionType }
  await connection.execute(
    `UPDATE player_behavior_profiles SET caution_score = caution_score + ?, recklessness_score = recklessness_score + ?, mercy_score = mercy_score + ?,
       favorite_weapons_json = ?, preferred_skills_json = ?, combat_rhythm_json = ?, decision_style_json = ? WHERE character_life_id = ?`,
    [caution, reckless, mercy, JSON.stringify(weaponCounts), JSON.stringify(skillCounts), JSON.stringify(rhythm), JSON.stringify(decisionStyle), state.run.character_life_id],
  )
}

async function resolveTurn(state, action, interpretation = null, requestKey = null, options = {}) {
  const signatures = interpretation?.signatures?.length ? interpretation.signatures : deriveActionSignatures(action)
  const actionType = actionTypeFrom(signatures, interpretation)
  const usedSkill = findUsedSkill(action, state.skills)
  const actionCheck = evaluateActionCheck(state, actionType, interpretation, options.actionCheckRoll)
  const successLevel = actionCheck?.outcome || 'success'
  const effectiveSignatures = successLevel === 'failure' ? [] : signatures
  const result = {
    actionType,
    interpretation,
    attemptedSignatures: signatures,
    signatures: effectiveSignatures,
    actionCheck,
    successLevel,
    rewards: { xp: 0, gold: 0, soulEnergy: 0 },
    skillProgress: [],
    skillsUnlocked: [],
    itemsAwarded: [],
    companions: [],
    events: [],
    achievements: [],
    familyMastery: [],
    ultimateTrials: [],
    evolutionChoices: [],
    quests: [],
    storyThreads: [],
    reputation: [],
    floorProgressGain: successLevel === 'failure' ? 0 : successLevel === 'exceptional' ? 2 : 1,
    combat: null,
    advanced: null,
    runCompleted: false,
    died: false,
  }

  const resolved = await withTransaction(async (connection) => {
    if (requestKey) {
      const actionHash = crypto.createHash('sha256').update(action).digest('hex')
      const [requests] = await connection.execute(
        'SELECT action_hash, status, resolution_json FROM engine_turn_requests WHERE story_cycle_id = ? AND request_key = ? FOR UPDATE',
        [state.run.id, requestKey],
      )
      if (requests[0]) {
        if (requests[0].action_hash !== actionHash) throw new Error('The requestKey was already used for a different action.')
        if (requests[0].status === 'completed') return parseJson(requests[0].resolution_json, result)
      } else {
        await connection.execute(
          `INSERT INTO engine_turn_requests (story_cycle_id, character_life_id, request_key, action_hash)
           VALUES (?, ?, ?, ?)`,
          [state.run.id, state.run.character_life_id, requestKey, actionHash],
        )
      }
    }
    await connection.execute('UPDATE story_progress SET total_turns = total_turns + 1 WHERE story_cycle_id = ?', [state.run.id])
    await initializeFloor(connection, state, state.currentDungeon.id, state.run.current_floor_id)
    await processCompanionAction(connection, state, action, effectiveSignatures, result)
    await useConsumable(connection, state, action, result)
    const encounter = await getOrStartEncounter(connection, state, actionType)
    const combatResolved = await resolveMultiCombat(connection, state, encounter, action, actionType, effectiveSignatures, usedSkill, result)
    if (encounter && !combatResolved && !['analyze', 'defend', 'dodge', 'heal', 'attack'].includes(actionType)) result.floorProgressGain = 0
    await useOwnedSkill(connection, state, usedSkill, result)
    await progressSkills(connection, state, action, effectiveSignatures, result.successLevel, result)
    await updateQuests(connection, state, effectiveSignatures, result)
    await updateStoryThreads(connection, state, result)
    await updateFactionReputation(connection, state, effectiveSignatures, result)
    await processWorldEvents(connection, state, effectiveSignatures, result)
    await processAdvancedSkills(connection, state, action, effectiveSignatures, result)
    await updateBehavior(connection, state, action, actionType, effectiveSignatures, usedSkill)
    await advanceFloorIfReady(connection, state, result)
    await tickStatusEffects(connection, state, result)
    const [health] = await connection.execute('SELECT hp FROM character_sheets WHERE character_life_id = ?', [state.run.character_life_id])
    if (Number(health[0].hp) <= 0) {
      await connection.execute("UPDATE character_lives SET status = 'dead', death_scene = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?", [`Fell during combat on ${state.currentFloor.floor_name}.`, state.run.character_life_id])
      await connection.execute("UPDATE story_cycles SET status = 'dead', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [state.run.id])
      await connection.execute('UPDATE soul_profiles SET total_deaths = total_deaths + 1 WHERE id = ?', [state.run.soul_profile_id])
      if (encounter) await connection.execute("UPDATE combat_encounters SET status = 'defeat', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
      await closeCompanionsForDeath(connection, state)
      result.died = true
    }
    await recordEngineEvent(connection, state, 'turn_resolved', `turn-${Date.now()}`, result)
    if (requestKey) {
      await connection.execute(
        "UPDATE engine_turn_requests SET status = 'completed', resolution_json = ?, completed_at = CURRENT_TIMESTAMP WHERE story_cycle_id = ? AND request_key = ?",
        [JSON.stringify(result), state.run.id, requestKey],
      )
    }
    return result
  })
  return resolved
}

module.exports = { calculateEscapeChance, damageMultiplier, deriveActionSignatures, evaluateActionCheck, evaluateFloorGate, resolveTurn }
