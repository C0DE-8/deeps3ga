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

const avatarOptions = {
  races: ['Human', 'Ash Elf', 'Marsh Goblin', 'Moonkin', 'Ironborn'],
  classes: ['Wayfarer', 'Spellblade', 'Warden', 'Hex Weaver', 'Soul Scout'],
  personalities: ['watchful', 'defiant', 'compassionate', 'restless', 'methodical'],
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)]
}

async function listGameSaves(accountId) {
  return query(
    `SELECT sc.id AS story_cycle_id, sc.cycle_number, sc.status, sc.created_at, sc.ended_at,
            cl.id AS character_life_id, cl.status AS character_status, cs.character_name, cs.race_name,
            cs.class_name, cs.level, d.name AS dungeon_name, df.floor_number, df.floor_name
       FROM soul_profiles s JOIN story_cycles sc ON sc.soul_profile_id = s.id
       LEFT JOIN character_lives cl ON cl.story_cycle_id = sc.id
       LEFT JOIN character_sheets cs ON cs.character_life_id = cl.id
       LEFT JOIN story_progress sp ON sp.story_cycle_id = sc.id
       LEFT JOIN dungeons d ON d.id = sp.current_dungeon_id
       LEFT JOIN dungeon_floors df ON df.id = sp.current_floor_id
      WHERE s.account_id = ? ORDER BY sc.created_at DESC`,
    [accountId],
  )
}

async function createGame(accountId) {
  return withTransaction(async (connection) => {
    const [existingActive] = await connection.execute(
      `SELECT sc.id FROM story_cycles sc JOIN soul_profiles s ON s.id = sc.soul_profile_id
        WHERE s.account_id = ? AND sc.status IN ('opening_death', 'awake', 'in_progress') LIMIT 1`,
      [accountId],
    )
    if (existingActive[0]) return { storyCycleId: existingActive[0].id, resumed: true }

    let [souls] = await connection.execute('SELECT * FROM soul_profiles WHERE account_id = ? LIMIT 1', [accountId])
    if (!souls[0]) {
      const [accounts] = await connection.execute('SELECT username FROM accounts WHERE id = ?', [accountId])
      const [created] = await connection.execute('INSERT INTO soul_profiles (account_id, soul_name) VALUES (?, ?)', [accountId, accounts[0].username])
      ;[souls] = await connection.execute('SELECT * FROM soul_profiles WHERE id = ?', [created.insertId])
    }
    const soul = souls[0]
    const [cycleCounts] = await connection.execute('SELECT COALESCE(MAX(cycle_number), 0) AS count FROM story_cycles WHERE soul_profile_id = ?', [soul.id])
    const [lifeCounts] = await connection.execute('SELECT COALESCE(MAX(life_number), 0) AS count FROM character_lives WHERE soul_profile_id = ?', [soul.id])
    const cycleNumber = Number(cycleCounts[0].count) + 1
    const lifeNumber = Number(lifeCounts[0].count) + 1
    const [legacy] = await connection.execute('SELECT id FROM legacy_heroes WHERE soul_profile_id = ? ORDER BY legacy_number DESC LIMIT 1', [soul.id])
    const [cycleResult] = await connection.execute(
      `INSERT INTO story_cycles (soul_profile_id, previous_guardian_id, cycle_number, status, opening_death_json)
       VALUES (?, NULL, ?, 'in_progress', ?)`,
      [soul.id, cycleNumber, JSON.stringify({ setting: 'rain-soaked city street', finalSense: 'the sound of rain fading', chosenByPlayer: false })],
    )
    const storyCycleId = cycleResult.insertId
    const race = randomFrom(avatarOptions.races)
    const className = randomFrom(avatarOptions.classes)
    const personality = randomFrom(avatarOptions.personalities)
    const characterName = `${randomFrom(['Aren', 'Veya', 'Korr', 'Mira', 'Solen'])} ${randomFrom(['Ashwake', 'Thorn', 'Vale', 'Rune', 'Dusk'])}`
    const [lifeResult] = await connection.execute(
      `INSERT INTO character_lives (soul_profile_id, story_cycle_id, life_number, avatar_json, origin_death_scene)
       VALUES (?, ?, ?, ?, ?)`,
      [soul.id, storyCycleId, lifeNumber, JSON.stringify({ name: characterName, race, class: className, personality }), 'Rain erased the city as the soul took its final breath.'],
    )
    const lifeId = lifeResult.insertId
    await connection.execute(
      `INSERT INTO character_sheets (character_life_id, character_name, race_name, class_name, appearance_json, personality_json, titles_json, stats_json, blessings_json, curses_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lifeId, characterName, race, className, JSON.stringify({ cloak: 'torn', eyes: 'unfamiliar', condition: 'newly awakened' }), JSON.stringify({ primary: personality }), '[]', JSON.stringify({ strength: 6, agility: 6, intelligence: 6, will: 7, perception: 5 }), '[]', '[]'],
    )
    await connection.execute('INSERT INTO story_progress (story_cycle_id, current_dungeon_id, current_floor_id, story_state_json) VALUES (?, 1, 101, ?)', [storyCycleId, JSON.stringify({ chapter: 1, scene: 'last-breath', legacyHeroId: legacy[0]?.id || null })])
    await connection.execute('INSERT INTO player_behavior_profiles (character_life_id) VALUES (?)', [lifeId])
    await connection.execute("INSERT INTO character_inventory (character_life_id, item_id, quantity, equipped_slot, item_state_json) SELECT ?, id, 1, CASE item_key WHEN 'rust-dagger' THEN 'weapon' WHEN 'torn-cloak' THEN 'armor' END, '{}' FROM items WHERE item_key IN ('rust-dagger', 'torn-cloak')", [lifeId])
    await connection.execute("INSERT INTO character_skills (character_life_id, skill_id) SELECT ?, id FROM skills WHERE skill_key IN ('brace', 'soul-echo')", [lifeId])
    await connection.execute('INSERT INTO cycle_dungeon_progress (story_cycle_id, dungeon_id, highest_floor) VALUES (?, 1, 1)', [storyCycleId])
    await connection.execute("INSERT INTO cycle_npc_states (story_cycle_id, npc_id, current_floor_id, relationship_json, dialogue_state_json) SELECT ?, id, current_floor_id, '{}', '{}' FROM world_npcs WHERE current_floor_id = 101", [storyCycleId])
    await connection.execute("INSERT INTO cycle_monster_states (story_cycle_id, monster_id, current_floor_id, current_hp, state_json) SELECT ?, id, habitat_floor_id, COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(stats_json, '$.hp')) AS UNSIGNED), 20), '{}' FROM world_monsters WHERE habitat_floor_id = 101", [storyCycleId])
    await connection.execute("INSERT INTO cycle_boss_states (story_cycle_id, boss_profile_id, status, memory_of_player_json, encounter_state_json) SELECT ?, id, 'locked', '{}', '{}' FROM boss_profiles", [storyCycleId])
    return { storyCycleId, characterLifeId: lifeId, resumed: false }
  })
}

async function getGameState(storyCycleId) {
  const cycles = await query(
    `SELECT sc.*, sp.current_dungeon_id, sp.current_floor_id, sp.story_state_json,
            cl.id AS character_life_id, cl.life_number, cl.status AS character_status,
            s.id AS soul_profile_id, s.account_id, s.soul_name, s.total_deaths, s.total_completed_runs,
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

module.exports = { createGame, createLegacyHero, getGameState, listGameSaves, markCharacterDead, saveNarrativeTurn }
