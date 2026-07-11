const { query, withTransaction } = require('../connection')

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function hydrate(row, jsonFields) {
  if (!row) return null
  const result = { ...row }
  jsonFields.forEach(([field, fallback]) => {
    result[field] = parseJson(result[field], fallback)
  })
  return result
}

async function getGameState(storyCycleId) {
  const cycles = await query(
    `SELECT sc.*, sp.current_dungeon_id, sp.current_floor_id, sp.story_state_json,
            cl.id AS character_life_id, cl.life_number, cl.status AS character_status,
            s.id AS soul_profile_id, s.soul_name, s.total_deaths, s.total_completed_runs,
            s.remembered_knowledge_json
       FROM story_cycles sc
       JOIN soul_profiles s ON s.id = sc.soul_profile_id
       JOIN character_lives cl ON cl.story_cycle_id = sc.id AND cl.status = 'alive'
       JOIN story_progress sp ON sp.story_cycle_id = sc.id
      WHERE sc.id = ?`,
    [storyCycleId],
  )

  const run = hydrate(cycles[0], [
    ['story_state_json', {}],
    ['remembered_knowledge_json', {}],
    ['opening_death_json', {}],
  ])
  if (!run) return null

  const [sheets, dungeons, floors, npcs, monsters, bosses, quests, memories, choices, companions, skills, inventory, adaptations, legacyHeroes] = await Promise.all([
    query('SELECT * FROM character_sheets WHERE character_life_id = ?', [run.character_life_id]),
    query('SELECT * FROM dungeons WHERE id = ?', [run.current_dungeon_id]),
    query('SELECT * FROM dungeon_floors WHERE id = ?', [run.current_floor_id]),
    query(
      `SELECT n.*, ns.life_status AS run_life_status, ns.relationship_json AS run_relationship_json,
              ns.dialogue_state_json, ns.present
         FROM cycle_npc_states ns JOIN world_npcs n ON n.id = ns.npc_id
        WHERE ns.story_cycle_id = ? AND ns.current_floor_id = ? AND ns.present = 1`,
      [storyCycleId, run.current_floor_id],
    ),
    query(
      `SELECT m.*, ms.id AS instance_id, ms.current_hp, ms.status, ms.state_json
         FROM cycle_monster_states ms JOIN world_monsters m ON m.id = ms.monster_id
        WHERE ms.story_cycle_id = ? AND ms.current_floor_id = ? AND ms.status IN ('alive', 'friendly')`,
      [storyCycleId, run.current_floor_id],
    ),
    query(
      `SELECT bp.*, bs.status, bs.current_phase, bs.current_hp, bs.memory_of_player_json, bs.encounter_state_json
         FROM boss_profiles bp
         JOIN cycle_boss_states bs ON bs.boss_profile_id = bp.id
        WHERE bs.story_cycle_id = ? AND bp.dungeon_floor_id = ?`,
      [storyCycleId, run.current_floor_id],
    ),
    query(
      `SELECT q.*, cq.status, cq.progress_json, cq.choices_json
         FROM cycle_quests cq JOIN quests q ON q.id = cq.quest_id
        WHERE cq.story_cycle_id = ? AND cq.status IN ('available', 'active')`,
      [storyCycleId],
    ),
    query(
      `SELECT scope, memory_key, summary, facts_json, importance, remembered_across_lives, created_at
         FROM story_memories WHERE soul_profile_id = ? AND (story_cycle_id = ? OR remembered_across_lives = 1)
        ORDER BY importance DESC, created_at DESC LIMIT 50`,
      [run.soul_profile_id, storyCycleId],
    ),
    query(
      `SELECT action_text, action_kind, intent_json, outcome_json, created_at
         FROM choice_history WHERE story_cycle_id = ? ORDER BY created_at DESC LIMIT 30`,
      [storyCycleId],
    ),
    query(
      `SELECT c.*, COALESCE(JSON_ARRAYAGG(JSON_OBJECT('type', cm.memory_type, 'text', cm.memory_text, 'sentiment', cm.sentiment)), JSON_ARRAY()) AS memories
         FROM companions c LEFT JOIN companion_memories cm ON cm.companion_id = c.id
        WHERE c.story_cycle_id = ? AND c.active = 1 GROUP BY c.id`,
      [storyCycleId],
    ),
    query(
      `SELECT s.skill_key, s.name, s.skill_type, s.description, s.effects_json, cs.skill_level, cs.times_used, cs.equipped
         FROM character_skills cs JOIN skills s ON s.id = cs.skill_id
        WHERE cs.character_life_id = ?`,
      [run.character_life_id],
    ),
    query(
      `SELECT i.item_key, i.name, i.item_type, i.description, i.rarity, i.effects_json,
              ci.quantity, ci.equipped_slot, ci.item_state_json
         FROM character_inventory ci JOIN items i ON i.id = ci.item_id
        WHERE ci.character_life_id = ?`,
      [run.character_life_id],
    ),
    query('SELECT * FROM dungeon_adaptations WHERE soul_profile_id = ? AND active = 1', [run.soul_profile_id]),
    query(
      `SELECT id, legacy_number, hero_name, final_title, identity_snapshot_json, character_snapshot_json,
              skills_snapshot_json, equipment_snapshot_json, combat_style_snapshot_json, boss_snapshot_json
         FROM legacy_heroes WHERE soul_profile_id = ? ORDER BY legacy_number DESC LIMIT 1`,
      [run.soul_profile_id],
    ),
  ])

  return {
    run,
    characterSheet: hydrate(sheets[0], [['appearance_json', {}], ['personality_json', {}], ['titles_json', []], ['stats_json', {}], ['blessings_json', []], ['curses_json', []]]),
    currentDungeon: hydrate(dungeons[0], [['unlock_requirements_json', {}], ['story_arc_json', {}]]),
    currentFloor: hydrate(floors[0], [['enemies_available_json', []], ['npcs_available_json', []], ['hidden_events_json', []], ['floor_memory_json', {}], ['boss_rules_json', {}]]),
    activeNpcs: npcs.map((row) => hydrate(row, [['personality_json', {}], ['dialogue_json', []], ['run_relationship_json', {}], ['dialogue_state_json', {}]])),
    activeMonsters: monsters.map((row) => hydrate(row, [['stats_json', {}], ['skills_json', []], ['loot_json', []], ['behavior_json', {}], ['state_json', {}]])),
    activeBoss: hydrate(bosses[0], [['personality_json', {}], ['dialogue_json', []], ['mechanics_json', {}], ['memory_of_player_json', {}], ['encounter_state_json', {}]]),
    activeQuests: quests.map((row) => hydrate(row, [['objectives_json', []], ['rewards_json', []], ['consequence_rules_json', {}], ['progress_json', {}], ['choices_json', []]])),
    storyMemory: memories.map((row) => hydrate(row, [['facts_json', {}]])),
    previousChoices: choices.map((row) => hydrate(row, [['intent_json', {}], ['outcome_json', {}]])),
    companions: companions.map((row) => hydrate(row, [['personality_json', {}], ['secrets_json', []], ['relationship_state_json', {}], ['memories', []]])),
    skills: skills.map((row) => hydrate(row, [['effects_json', {}]])),
    inventory: inventory.map((row) => hydrate(row, [['effects_json', {}], ['item_state_json', {}]])),
    dungeonAdaptations: adaptations.map((row) => hydrate(row, [['affected_enemy_rules_json', {}]])),
    previousLegacyHero: hydrate(legacyHeroes[0], [['identity_snapshot_json', {}], ['character_snapshot_json', {}], ['skills_snapshot_json', []], ['equipment_snapshot_json', []], ['combat_style_snapshot_json', {}], ['boss_snapshot_json', {}]]),
  }
}

async function saveNarrativeTurn({ state, playerAction, actionKind, scene }) {
  return withTransaction(async (connection) => {
    const [playerMessage] = await connection.execute(
      `INSERT INTO narrative_messages (story_cycle_id, character_life_id, speaker, message_text, parsed_intent_json)
       VALUES (?, ?, 'player', ?, ?)`,
      [state.run.id, state.run.character_life_id, playerAction, JSON.stringify(scene.parsedIntent || {})],
    )
    await connection.execute(
      `INSERT INTO choice_history (story_cycle_id, character_life_id, floor_id, action_text, action_kind, intent_json, outcome_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [state.run.id, state.run.character_life_id, state.run.current_floor_id, playerAction, actionKind, JSON.stringify(scene.parsedIntent || {}), JSON.stringify(scene.consequences || [])],
    )
    const [narratorMessage] = await connection.execute(
      `INSERT INTO narrative_messages (story_cycle_id, character_life_id, speaker, message_text, choices_json, consequence_json)
       VALUES (?, ?, 'narrator', ?, ?, ?)`,
      [state.run.id, state.run.character_life_id, scene.story || '', JSON.stringify(scene.choices || []), JSON.stringify(scene.consequences || [])],
    )
    await connection.execute(
      `INSERT INTO response_sections (narrative_message_id, story_text, character_changes_json, new_items_or_skills_json, choices_json)
       VALUES (?, ?, ?, ?, ?)`,
      [narratorMessage.insertId, scene.story || '', JSON.stringify(scene.characterChanges || []), JSON.stringify(scene.newItemsOrSkills || []), JSON.stringify(scene.choices || [])],
    )
    for (const memory of scene.memorySignals || []) {
      const normalized = typeof memory === 'string' ? { summary: memory } : memory
      await connection.execute(
        `INSERT INTO story_memories (soul_profile_id, story_cycle_id, character_life_id, scope, memory_key, summary, facts_json, importance, remembered_across_lives)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [state.run.soul_profile_id, state.run.id, state.run.character_life_id, normalized.scope || 'run', normalized.key || `turn-${narratorMessage.insertId}`, normalized.summary || '', JSON.stringify(normalized.facts || {}), normalized.importance || 1, normalized.rememberedAcrossLives ? 1 : 0],
      )
    }
    return { playerMessageId: playerMessage.insertId, narrativeMessageId: narratorMessage.insertId }
  })
}

async function markCharacterDead(storyCycleId, deathScene) {
  return withTransaction(async (connection) => {
    const [lives] = await connection.execute("SELECT id, soul_profile_id FROM character_lives WHERE story_cycle_id = ? AND status = 'alive' FOR UPDATE", [storyCycleId])
    if (!lives[0]) throw new Error('No living character exists for this story cycle.')
    await connection.execute("UPDATE character_lives SET status = 'dead', death_scene = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?", [deathScene, lives[0].id])
    await connection.execute("UPDATE story_cycles SET status = 'dead', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [storyCycleId])
    await connection.execute('UPDATE soul_profiles SET total_deaths = total_deaths + 1 WHERE id = ?', [lives[0].soul_profile_id])
    return { characterLifeId: lives[0].id, legacyHeroCreated: false }
  })
}

async function createLegacyHero(storyCycleId, bossData = {}) {
  return withTransaction(async (connection) => {
    const [cycles] = await connection.execute(
      `SELECT sc.soul_profile_id, cl.id AS character_life_id, cs.*
         FROM story_cycles sc JOIN character_lives cl ON cl.story_cycle_id = sc.id
         JOIN character_sheets cs ON cs.character_life_id = cl.id
        WHERE sc.id = ? AND cl.status = 'alive' FOR UPDATE`,
      [storyCycleId],
    )
    if (!cycles[0]) throw new Error('A living completed character is required.')
    const source = cycles[0]
    const [progress] = await connection.execute('SELECT COUNT(*) AS cleared FROM cycle_dungeon_progress WHERE story_cycle_id = ? AND boss_defeated = 1 AND completed_at IS NOT NULL', [storyCycleId])
    if (Number(progress[0].cleared) !== 10) throw new Error('Legacy Heroes require all 10 realms and bosses to be completed.')
    const [existing] = await connection.execute('SELECT id FROM legacy_heroes WHERE source_story_cycle_id = ?', [storyCycleId])
    if (existing[0]) return { id: existing[0].id, alreadyCreated: true }
    const [skillRows] = await connection.execute(`SELECT s.*, cs.skill_level, cs.times_used, cs.equipped FROM character_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.character_life_id = ?`, [source.character_life_id])
    const [itemRows] = await connection.execute(`SELECT i.*, ci.quantity, ci.equipped_slot, ci.item_state_json FROM character_inventory ci JOIN items i ON i.id = ci.item_id WHERE ci.character_life_id = ?`, [source.character_life_id])
    const [behaviors] = await connection.execute('SELECT * FROM player_behavior_profiles WHERE character_life_id = ?', [source.character_life_id])
    const [legacyCount] = await connection.execute('SELECT COUNT(*) AS count FROM legacy_heroes WHERE soul_profile_id = ?', [source.soul_profile_id])
    const identity = { name: source.character_name, race: source.race_name, class: source.class_name, gender: source.gender_name, appearance: parseJson(source.appearance_json, {}), personality: parseJson(source.personality_json, {}), titles: parseJson(source.titles_json, []) }
    const character = { level: source.level, xp: source.xp, hp: source.max_hp, mana: source.max_mana, stamina: source.max_stamina, stats: parseJson(source.stats_json, {}), blessings: parseJson(source.blessings_json, []), curses: parseJson(source.curses_json, []) }
    const equipment = itemRows.filter((item) => item.equipped_slot)
    const finalTitle = bossData.finalTitle || identity.titles.at(-1) || 'Eternal Guardian'
    const bossSnapshot = { arena: bossData.arena || 'Throne of the Previous Self', music: bossData.music || 'Echoes of the Conqueror', introDialogue: bossData.introDialogue || `I remember being ${source.character_name}.`, defeatDialogue: bossData.defeatDialogue || 'Become more than I was.', phases: bossData.phases || ['signature opening', 'adaptive rhythm', 'legacy desperation'], finalHp: source.max_hp, finalMana: source.max_mana, activePassives: skillRows.filter((skill) => skill.skill_type === 'passive').map((skill) => skill.name) }
    const [result] = await connection.execute(
      `INSERT INTO legacy_heroes (soul_profile_id, source_story_cycle_id, source_character_life_id, legacy_number, hero_name, final_title, identity_snapshot_json, character_snapshot_json, skills_snapshot_json, equipment_snapshot_json, inventory_snapshot_json, combat_style_snapshot_json, boss_snapshot_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [source.soul_profile_id, storyCycleId, source.character_life_id, Number(legacyCount[0].count) + 1, source.character_name, finalTitle, JSON.stringify(identity), JSON.stringify(character), JSON.stringify(skillRows), JSON.stringify(equipment), JSON.stringify(itemRows), JSON.stringify(behaviors[0] || {}), JSON.stringify(bossSnapshot)],
    )
    await connection.execute("UPDATE character_lives SET status = 'claimed_by_dungeon', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [source.character_life_id])
    await connection.execute("UPDATE story_cycles SET status = 'completed', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [storyCycleId])
    await connection.execute('UPDATE soul_profiles SET total_completed_runs = total_completed_runs + 1 WHERE id = ?', [source.soul_profile_id])
    return { id: result.insertId, heroName: source.character_name, finalTitle, locked: true }
  })
}

module.exports = { createLegacyHero, getGameState, markCharacterDead, saveNarrativeTurn }
