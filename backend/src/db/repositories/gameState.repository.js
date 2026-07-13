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

async function listVisibleSkillCatalog() {
  const rows = await query(
    `SELECT s.skill_key, s.name, s.skill_type, s.category, s.rarity, s.visibility, s.family_tier,
            s.description, s.identity_text, s.unlock_hint, sf.family_key, sf.name AS family_name
       FROM skills s LEFT JOIN skill_families sf ON sf.id = s.family_id
      WHERE s.visibility <> 'hidden'
      ORDER BY COALESCE(sf.id, 999), s.family_tier, s.name`,
  )
  return rows
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
      `INSERT INTO character_sheets (character_life_id, character_name, species_name, race_name, class_name, appearance_json, personality_json, titles_json, strength, agility, defense, thaumaturgy, resolve_stat, intelligence, luck, charisma, stats_json, traits_json, blessings_json, curses_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 6, 6, 5, 4, 7, 6, 5, 5, ?, ?, ?, ?)`,
      [lifeId, characterName, race, race, className, JSON.stringify({ cloak: 'torn', eyes: 'unfamiliar', condition: 'newly awakened' }), JSON.stringify({ primary: personality }), '[]', JSON.stringify({ perception: 5 }), JSON.stringify([{ name: personality, source: 'reincarnation' }]), '[]', '[]'],
    )
    await connection.execute("INSERT INTO story_progress (story_cycle_id, current_dungeon_id, current_floor_id, current_chapter, current_scene, story_state_json) VALUES (?, 1, 101, 1, 'last-breath', ?)", [storyCycleId, JSON.stringify({ chapter: 1, scene: 'last-breath', legacyHeroId: legacy[0]?.id || null })])
    await connection.execute('INSERT INTO player_behavior_profiles (character_life_id) VALUES (?)', [lifeId])
    await connection.execute("INSERT INTO character_inventory (character_life_id, item_id, quantity, equipped_slot, item_state_json) SELECT ?, id, 1, CASE item_key WHEN 'rust-dagger' THEN 'weapon' WHEN 'torn-cloak' THEN 'armor' END, '{}' FROM items WHERE item_key IN ('rust-dagger', 'torn-cloak')", [lifeId])
    await connection.execute("INSERT IGNORE INTO equipment_states (character_inventory_id, bonuses_json) SELECT id, '{}' FROM character_inventory WHERE character_life_id = ? AND equipped_slot IS NOT NULL", [lifeId])
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
    `SELECT sc.*, sp.current_dungeon_id, sp.current_floor_id, sp.current_chapter, sp.current_scene, sp.story_state_json,
            cl.id AS character_life_id, cl.life_number, cl.status AS character_status,
            s.id AS soul_profile_id, s.account_id, s.soul_name, s.soul_level, s.soul_energy, s.total_deaths, s.total_completed_runs,
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

  const [sheets, dungeons, floors, npcs, monsters, bosses, quests, memories, choices, companions, companionMemories, companionSoulMemories, companionInjuries, skills, equipment, inventory, statuses, traits, injuries, lifeHistory, progressionEvents, engineEvents, activeEncounters, combatParticipants, cycleEvents, achievements, familyMastery, evolutionChoices, ultimateTrials, adaptations, legacyHeroes] = await Promise.all([
    query('SELECT * FROM character_sheets WHERE character_life_id = ?', [run.character_life_id]),
    query('SELECT * FROM dungeons WHERE id = ?', [run.current_dungeon_id]),
    query('SELECT * FROM dungeon_floors WHERE id = ?', [run.current_floor_id]),
    query(
      `SELECT n.*, ns.life_status AS run_life_status, ns.relationship_json AS run_relationship_json,
              ns.dialogue_state_json, ns.present, ns.recruitment_status
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
      'SELECT * FROM companions WHERE story_cycle_id = ? AND active = 1',
      [storyCycleId],
    ),
    query(
      `SELECT cm.companion_id, cm.memory_type, cm.memory_text, cm.sentiment, cm.created_at
         FROM companion_memories cm JOIN companions c ON c.id = cm.companion_id
        WHERE c.story_cycle_id = ? AND c.active = 1 ORDER BY cm.created_at`,
      [storyCycleId],
    ),
    query('SELECT world_npc_id, memory_type, summary, emotional_weight, facts_json, created_at FROM companion_reincarnation_memories WHERE soul_profile_id = ? ORDER BY created_at DESC LIMIT 30', [run.soul_profile_id]),
    query(`SELECT ci.companion_id, ci.name, ci.severity, ci.effects_json, ci.created_at FROM companion_injuries ci JOIN companions c ON c.id = ci.companion_id WHERE c.story_cycle_id = ? AND ci.healed_at IS NULL`, [storyCycleId]),
    query(
      `SELECT s.skill_key, s.family_id, s.name, s.skill_type, s.category, s.rarity, s.visibility, s.family_tier, s.description, s.identity_text, s.effects_json, s.evolution_rules_json,
              cs.skill_level, cs.skill_xp, cs.xp_needed, cs.unlocked, cs.times_used, cs.last_used_at, cs.equipped
         FROM character_skills cs JOIN skills s ON s.id = cs.skill_id
        WHERE cs.character_life_id = ?`,
      [run.character_life_id],
    ),
    query(`SELECT ci.id AS inventory_id, ci.equipped_slot, es.durability, es.max_durability, es.upgrade_level, es.bound_to_soul, es.bonuses_json FROM character_inventory ci JOIN equipment_states es ON es.character_inventory_id = ci.id WHERE ci.character_life_id = ?`, [run.character_life_id]),
    query(
      `SELECT ci.id AS inventory_id, i.item_key, i.name, i.item_type, i.description, i.rarity, i.effects_json,
              ci.quantity, ci.equipped_slot, ci.item_state_json
         FROM character_inventory ci JOIN items i ON i.id = ci.item_id
        WHERE ci.character_life_id = ?`,
      [run.character_life_id],
    ),
    query(
      `SELECT se.status_key, se.name, se.category, se.description, cse.intensity, cse.remaining_turns,
              cse.source_type, cse.state_json, cse.applied_at
         FROM character_status_effects cse JOIN status_effects se ON se.id = cse.status_effect_id
        WHERE cse.character_life_id = ? AND cse.removed_at IS NULL`,
      [run.character_life_id],
    ),
    query('SELECT trait_key, name, description, source_type, effects_json, gained_at FROM character_traits WHERE character_life_id = ? ORDER BY gained_at', [run.character_life_id]),
    query('SELECT injury_key, name, description, body_location, severity, effects_json, created_at FROM character_injuries WHERE character_life_id = ? AND healed_at IS NULL ORDER BY created_at', [run.character_life_id]),
    query('SELECT soul_id, life_number, character_id, character_name, species_name, race_name, class_name, level, status, death_scene, completion_summary, life_started_at, life_ended_at FROM soul_life_history WHERE soul_id = ? ORDER BY life_number', [run.soul_profile_id]),
    query('SELECT event_type, source_type, source_id, amount, summary, payload_json, created_at FROM character_progression_events WHERE story_cycle_id = ? ORDER BY id DESC LIMIT 30', [storyCycleId]),
    query('SELECT event_type, event_key, event_payload_json, created_at FROM game_engine_events WHERE story_cycle_id = ? ORDER BY id DESC LIMIT 30', [storyCycleId]),
    query("SELECT id, encounter_type, status, round_number, state_json, started_at FROM combat_encounters WHERE story_cycle_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [storyCycleId]),
    query(`SELECT cp.* FROM combat_participants cp JOIN combat_encounters ce ON ce.id = cp.combat_encounter_id WHERE ce.story_cycle_id = ? AND ce.status = 'active' ORDER BY cp.team, cp.speed_stat DESC`, [storyCycleId]),
    query(`SELECT we.event_key, we.name, ce.status, ce.state_json, ce.triggered_at, ce.completed_at FROM cycle_events ce JOIN world_events we ON we.id = ce.world_event_id WHERE ce.story_cycle_id = ? ORDER BY we.id`, [storyCycleId]),
    query('SELECT achievement_key, name, description, evidence_json, achieved_at FROM character_achievements WHERE character_life_id = ? ORDER BY achieved_at', [run.character_life_id]),
    query(`SELECT sf.family_key, sf.name, cfm.mastery_xp, cfm.mastery_level, cfm.skills_unlocked, cfm.ultimate_trial_unlocked FROM character_family_mastery cfm JOIN skill_families sf ON sf.id = cfm.skill_family_id WHERE cfm.character_life_id = ?`, [run.character_life_id]),
    query(`SELECT sec.id, source.name AS source_name, option.name AS option_name, option.skill_key AS option_key, sec.status, sec.offered_reason_json FROM skill_evolution_choices sec JOIN skills source ON source.id = sec.source_skill_id JOIN skills option ON option.id = sec.option_skill_id WHERE sec.character_life_id = ? AND sec.status = 'available'`, [run.character_life_id]),
    query(`SELECT uts.trial_key, s.name AS skill_name, s.skill_key, uts.status, uts.progress, uts.required_progress, uts.conditions_json, uts.evidence_json FROM ultimate_skill_trials uts JOIN skills s ON s.id = uts.skill_id WHERE uts.character_life_id = ?`, [run.character_life_id]),
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
    characterSheet: hydrate(sheets[0], [['appearance_json', {}], ['personality_json', {}], ['titles_json', []], ['stats_json', {}], ['traits_json', []], ['blessings_json', []], ['curses_json', []]]),
    currentDungeon: hydrate(dungeons[0], [['unlock_requirements_json', {}], ['story_arc_json', {}]]),
    currentFloor: hydrate(floors[0], [['enemies_available_json', []], ['npcs_available_json', []], ['hidden_events_json', []], ['floor_memory_json', {}], ['boss_rules_json', {}]]),
    activeNpcs: npcs.map((row) => hydrate(row, [['personality_json', {}], ['dialogue_json', []], ['run_relationship_json', {}], ['dialogue_state_json', {}]])),
    activeMonsters: monsters.map((row) => hydrate(row, [['stats_json', {}], ['skills_json', []], ['loot_json', []], ['behavior_json', {}], ['state_json', {}]])),
    activeBoss: hydrate(bosses[0], [['personality_json', {}], ['dialogue_json', []], ['mechanics_json', {}], ['memory_of_player_json', {}], ['encounter_state_json', {}]]),
    activeQuests: quests.map((row) => hydrate(row, [['objectives_json', []], ['rewards_json', []], ['consequence_rules_json', {}], ['progress_json', {}], ['choices_json', []]])),
    storyMemory: memories.map((row) => hydrate(row, [['facts_json', {}]])),
    previousChoices: choices.map((row) => hydrate(row, [['intent_json', {}], ['outcome_json', {}]])),
    companions: companions.map((row) => ({
      ...hydrate(row, [['personality_json', {}], ['secrets_json', []], ['relationship_state_json', {}], ['combat_style_json', {}]]),
      memories: companionMemories
        .filter((memory) => Number(memory.companion_id) === Number(row.id))
        .map((memory) => ({
          type: memory.memory_type,
          text: memory.memory_text,
          sentiment: memory.sentiment,
          createdAt: memory.created_at,
        })),
    })),
    companionSoulMemories: companionSoulMemories.map((row) => hydrate(row, [['facts_json', {}]])),
    companionInjuries: companionInjuries.map((row) => hydrate(row, [['effects_json', {}]])),
    skills: skills.map((row) => hydrate(row, [['effects_json', {}], ['evolution_rules_json', {}]])),
    inventory: inventory.map((row) => hydrate(row, [['effects_json', {}], ['item_state_json', {}]])),
    equipment: equipment.map((row) => hydrate(row, [['bonuses_json', {}]])),
    statusEffects: statuses.map((row) => hydrate(row, [['state_json', {}]])),
    traits: traits.map((row) => hydrate(row, [['effects_json', {}]])),
    injuries: injuries.map((row) => hydrate(row, [['effects_json', {}]])),
    lifeHistory,
    progressionEvents: progressionEvents.map((row) => hydrate(row, [['payload_json', {}]])),
    engineEvents: engineEvents.map((row) => hydrate(row, [['event_payload_json', {}]])),
    activeEncounter: hydrate(activeEncounters[0], [['state_json', {}]]),
    combatParticipants: combatParticipants.map((row) => hydrate(row, [['resistances_json', {}], ['weaknesses_json', {}], ['state_json', {}]])),
    events: cycleEvents.map((row) => hydrate(row, [['state_json', {}]])),
    achievements: achievements.map((row) => hydrate(row, [['evidence_json', {}]])),
    familyMastery,
    evolutionChoices: evolutionChoices.map((row) => hydrate(row, [['offered_reason_json', {}]])),
    ultimateTrials: ultimateTrials.map((row) => hydrate(row, [['conditions_json', {}], ['evidence_json', {}]])),
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
    const memorySignals = Array.isArray(scene.memorySignals) ? scene.memorySignals : []
    for (const memory of memorySignals) {
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
    const [skillRows] = await connection.execute(`SELECT s.*, cs.skill_level, cs.skill_xp, cs.xp_needed, cs.unlocked, cs.times_used, cs.last_used_at, cs.equipped FROM character_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.character_life_id = ?`, [source.character_life_id])
    const [itemRows] = await connection.execute(`SELECT i.*, ci.quantity, ci.equipped_slot, ci.item_state_json FROM character_inventory ci JOIN items i ON i.id = ci.item_id WHERE ci.character_life_id = ?`, [source.character_life_id])
    const [behaviors] = await connection.execute('SELECT * FROM player_behavior_profiles WHERE character_life_id = ?', [source.character_life_id])
    const [statusRows] = await connection.execute(`SELECT se.status_key, se.name, se.category, cse.intensity, cse.remaining_turns, cse.state_json FROM character_status_effects cse JOIN status_effects se ON se.id = cse.status_effect_id WHERE cse.character_life_id = ? AND cse.removed_at IS NULL`, [source.character_life_id])
    const [traitRows] = await connection.execute('SELECT trait_key, name, description, source_type, effects_json FROM character_traits WHERE character_life_id = ?', [source.character_life_id])
    const [injuryRows] = await connection.execute('SELECT injury_key, name, description, body_location, severity, effects_json FROM character_injuries WHERE character_life_id = ? AND healed_at IS NULL', [source.character_life_id])
    const [legacyCount] = await connection.execute('SELECT COUNT(*) AS count FROM legacy_heroes WHERE soul_profile_id = ?', [source.soul_profile_id])
    const identity = { name: source.character_name, species: source.species_name, race: source.race_name, class: source.class_name, gender: source.gender_name, appearance: parseJson(source.appearance_json, {}), personality: parseJson(source.personality_json, {}), titles: parseJson(source.titles_json, []) }
    const character = {
      level: source.level,
      xp: source.xp,
      xpNeeded: source.xp_needed,
      hp: source.max_hp,
      mana: source.max_mana,
      stamina: source.max_stamina,
      health: source.health_condition,
      gold: source.gold,
      stats: {
        strength: source.strength,
        agility: source.agility,
        defense: source.defense,
        thaumaturgy: source.thaumaturgy,
        resolve: source.resolve_stat,
        intelligence: source.intelligence,
        luck: source.luck,
        charisma: source.charisma,
        ...parseJson(source.stats_json, {}),
      },
      traits: [...parseJson(source.traits_json, []), ...traitRows],
      statuses: statusRows,
      injuries: injuryRows,
      blessings: parseJson(source.blessings_json, []),
      curses: parseJson(source.curses_json, []),
    }
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

module.exports = { createGame, createLegacyHero, getGameState, listGameSaves, listVisibleSkillCatalog, markCharacterDead, saveNarrativeTurn }
