const { withTransaction } = require('../../db/connection')

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

function actionTypeFrom(signatures) {
  if (signatures.includes('flee')) return 'flee'
  if (signatures.includes('heal')) return 'heal'
  if (signatures.includes('defend')) return 'defend'
  if (signatures.includes('dodge')) return 'dodge'
  if (signatures.some((value) => ['attack', 'bite', 'magic'].includes(value))) return 'attack'
  if (signatures.some((value) => ['negotiate', 'befriend', 'spare'].includes(value))) return 'social'
  if (signatures.includes('analyze')) return 'analyze'
  return 'explore'
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

    await connection.execute(
      `INSERT INTO skill_progress_events (character_life_id, skill_id, story_cycle_id, action_text, action_signature, success_level, progress_amount, evidence_json)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [state.run.character_life_id, skill.id, state.run.id, action, signatures[0], successLevel, JSON.stringify({ signatures, floorId: state.run.current_floor_id })],
    )
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
  result.skillUsed = { name: skill.name, level, xp, xpNeeded: needed }
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
    if (status === 'completed') await grantProgression(connection, state, parseJson(quest.rewards_json, {}), 'quest', quest.id, result)
  }
}

async function getOrStartEncounter(connection, state, actionType) {
  const [active] = await connection.execute("SELECT * FROM combat_encounters WHERE story_cycle_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [state.run.id])
  if (active[0]) return active[0]
  if (actionType !== 'attack') return null

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

async function resolveCombat(connection, state, encounter, action, actionType, signatures, usedSkill, result) {
  if (!encounter) return false
  result.combat = { encounterId: encounter.id, type: encounter.encounter_type, round: encounter.round_number }
  if (actionType === 'flee') {
    await connection.execute("UPDATE combat_encounters SET status = 'escaped', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
    result.combat.status = 'escaped'
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

async function initializeFloor(connection, state, dungeonId, floorId) {
  const [floorRows] = await connection.execute('SELECT floor_type, purpose_type FROM dungeon_floors WHERE id = ?', [floorId])
  const floor = floorRows[0]
  const combatRequired = floor.floor_type === 'boss'
  await connection.execute(
    `INSERT INTO floor_runtime_states (story_cycle_id, floor_id, status, objective_required, combat_required, entered_at, state_json)
     VALUES (?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, '{}')
     ON DUPLICATE KEY UPDATE status = IF(status = 'cleared', status, 'active'), entered_at = COALESCE(entered_at, CURRENT_TIMESTAMP)`,
    [state.run.id, floorId, floor.floor_type === 'boss' ? 1 : 3, combatRequired ? 1 : 0],
  )
  await connection.execute(
    `INSERT IGNORE INTO cycle_npc_states (story_cycle_id, npc_id, current_floor_id, relationship_json, dialogue_state_json)
     SELECT ?, id, ?, '{}', '{}' FROM world_npcs WHERE current_floor_id = ?`,
    [state.run.id, floorId, floorId],
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

async function advanceFloorIfReady(connection, state, result) {
  const [runtimeRows] = await connection.execute('SELECT * FROM floor_runtime_states WHERE story_cycle_id = ? AND floor_id = ? FOR UPDATE', [state.run.id, state.run.current_floor_id])
  const runtime = runtimeRows[0]
  if (!runtime) return
  const progress = Number(runtime.objective_progress) + result.floorProgressGain
  const combatCompleted = runtime.combat_completed || ['victory', 'resolved_peacefully'].includes(result.combat?.status)
  const ready = progress >= Number(runtime.objective_required) && (!runtime.combat_required || combatCompleted)
  await connection.execute('UPDATE floor_runtime_states SET scene_count = scene_count + 1, objective_progress = ?, combat_completed = ? WHERE story_cycle_id = ? AND floor_id = ?', [progress, combatCompleted ? 1 : 0, state.run.id, state.run.current_floor_id])
  result.floor = { progress, required: Number(runtime.objective_required), ready }
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

async function updateBehavior(connection, state, actionType, signatures) {
  const caution = ['defend', 'dodge', 'analyze'].includes(actionType) ? 1 : 0
  const reckless = actionType === 'attack' ? 1 : 0
  const mercy = signatures.some((value) => ['spare', 'protect', 'heal', 'befriend'].includes(value)) ? 1 : 0
  await connection.execute(
    `UPDATE player_behavior_profiles SET caution_score = caution_score + ?, recklessness_score = recklessness_score + ?, mercy_score = mercy_score + ?,
       decision_style_json = ? WHERE character_life_id = ?`,
    [caution, reckless, mercy, JSON.stringify({ lastActionType: actionType, lastSignatures: signatures }), state.run.character_life_id],
  )
}

async function resolveTurn(state, action) {
  const signatures = deriveActionSignatures(action)
  const actionType = actionTypeFrom(signatures)
  const usedSkill = findUsedSkill(action, state.skills)
  const result = {
    actionType,
    signatures,
    successLevel: 'success',
    rewards: { xp: 0, gold: 0, soulEnergy: 0 },
    skillProgress: [],
    skillsUnlocked: [],
    itemsAwarded: [],
    quests: [],
    floorProgressGain: 1,
    combat: null,
    advanced: null,
    runCompleted: false,
    died: false,
  }

  await withTransaction(async (connection) => {
    await connection.execute('UPDATE story_progress SET total_turns = total_turns + 1 WHERE story_cycle_id = ?', [state.run.id])
    await initializeFloor(connection, state, state.currentDungeon.id, state.run.current_floor_id)
    const encounter = await getOrStartEncounter(connection, state, actionType)
    const combatResolved = await resolveCombat(connection, state, encounter, action, actionType, signatures, usedSkill, result)
    if (encounter && !combatResolved && !['analyze', 'defend', 'dodge', 'heal', 'attack'].includes(actionType)) result.floorProgressGain = 0
    await useOwnedSkill(connection, state, usedSkill, result)
    await progressSkills(connection, state, action, signatures, result.successLevel, result)
    await updateQuests(connection, state, signatures, result)
    await updateBehavior(connection, state, actionType, signatures)
    await advanceFloorIfReady(connection, state, result)
    const [health] = await connection.execute('SELECT hp FROM character_sheets WHERE character_life_id = ?', [state.run.character_life_id])
    if (Number(health[0].hp) <= 0) {
      await connection.execute("UPDATE character_lives SET status = 'dead', death_scene = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?", [`Fell during combat on ${state.currentFloor.floor_name}.`, state.run.character_life_id])
      await connection.execute("UPDATE story_cycles SET status = 'dead', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [state.run.id])
      await connection.execute('UPDATE soul_profiles SET total_deaths = total_deaths + 1 WHERE id = ?', [state.run.soul_profile_id])
      if (encounter) await connection.execute("UPDATE combat_encounters SET status = 'defeat', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [encounter.id])
      result.died = true
    }
    await recordEngineEvent(connection, state, 'turn_resolved', `turn-${Date.now()}`, result)
  })
  return result
}

module.exports = { deriveActionSignatures, resolveTurn }
