const { query } = require('../connection')

const tableConfig = {
  players: { table: 'accounts', order: 'created_at', columns: 'id, username, email, role, created_at, updated_at, last_login_at' },
  souls: { table: 'soul_profiles', order: 'created_at' },
  characters: { table: 'character_lives', order: 'created_at' },
  characterSheets: { table: 'character_sheets', order: 'updated_at' },
  cycles: { table: 'story_cycles', order: 'created_at' },
  dungeons: { table: 'dungeons', order: 'dungeon_number' },
  floors: { table: 'dungeon_floors', order: 'id' },
  floorStoryBeats: { table: 'floor_story_beats', order: 'id' },
  bosses: { table: 'boss_profiles', order: 'id' },
  npcs: { table: 'world_npcs', order: 'id' },
  monsters: { table: 'world_monsters', order: 'id' },
  skills: { table: 'skills', order: 'id' },
  items: { table: 'items', order: 'id' },
  quests: { table: 'quests', order: 'id' },
  memories: { table: 'story_memories', order: 'created_at' },
  choices: { table: 'choice_history', order: 'created_at' },
  companions: { table: 'companions', order: 'created_at' },
  legacyHeroes: { table: 'legacy_heroes', order: 'created_at' },
  worldEvents: { table: 'world_events', order: 'id' },
  cycleEvents: { table: 'cycle_events', order: 'story_cycle_id' },
  combatEncounters: { table: 'combat_encounters', order: 'started_at' },
  combatParticipants: { table: 'combat_participants', order: 'id' },
  companionRelationships: { table: 'companion_relationship_events', order: 'created_at' },
  companionSoulMemories: { table: 'companion_reincarnation_memories', order: 'created_at' },
  companionInjuries: { table: 'companion_injuries', order: 'created_at' },
  achievements: { table: 'character_achievements', order: 'achieved_at' },
  familyMastery: { table: 'character_family_mastery', order: 'updated_at' },
  evolutionChoices: { table: 'skill_evolution_choices', order: 'offered_at' },
  ultimateTrials: { table: 'ultimate_skill_trials', order: 'id' },
  turnRequests: { table: 'engine_turn_requests', order: 'created_at', columns: 'id, story_cycle_id, character_life_id, request_key, action_hash, status, created_at, completed_at' },
  narrativeValidation: { table: 'narrative_validation_events', order: 'created_at' },
  storyThreads: { table: 'story_threads', order: 'id' },
  cycleStoryThreads: { table: 'cycle_story_threads', order: 'updated_at' },
  factions: { table: 'factions', order: 'id' },
  factionReputation: { table: 'cycle_faction_reputation', order: 'updated_at' },
}

async function getOverview() {
  const [counts, recentPlayers, activeRuns, legacyHeroes, bossStates] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*) FROM accounts) AS players,
      (SELECT COUNT(*) FROM story_cycles WHERE status = 'in_progress') AS active_runs,
      (SELECT COUNT(*) FROM character_lives WHERE status = 'dead') AS deaths,
      (SELECT COUNT(*) FROM legacy_heroes) AS legacy_heroes,
      (SELECT COUNT(*) FROM story_memories) AS memories,
      (SELECT COUNT(*) FROM narrative_messages) AS narrative_messages`),
    query('SELECT id, username, email, role, created_at, last_login_at FROM accounts ORDER BY created_at DESC LIMIT 8'),
    query(`SELECT sc.id, sc.cycle_number, sc.status, sc.created_at, a.username, d.name AS dungeon_name, df.floor_number, df.floor_name
      FROM story_cycles sc JOIN soul_profiles spf ON spf.id = sc.soul_profile_id JOIN accounts a ON a.id = spf.account_id
      LEFT JOIN story_progress sp ON sp.story_cycle_id = sc.id LEFT JOIN dungeons d ON d.id = sp.current_dungeon_id
      LEFT JOIN dungeon_floors df ON df.id = sp.current_floor_id ORDER BY sc.created_at DESC LIMIT 10`),
    query('SELECT id, hero_name, final_title, legacy_number, created_at FROM legacy_heroes ORDER BY created_at DESC LIMIT 8'),
    query(`SELECT bp.boss_name, bs.status, COUNT(*) AS total FROM cycle_boss_states bs JOIN boss_profiles bp ON bp.id = bs.boss_profile_id GROUP BY bp.boss_name, bs.status ORDER BY bp.boss_name`),
  ])
  return { counts: counts[0], recentPlayers, activeRuns, legacyHeroes, bossStates, datasets: Object.keys(tableConfig) }
}

async function getDataset(name, page = 1, pageSize = 25) {
  const config = tableConfig[name]
  if (!config) throw new Error('Unknown admin dataset.')
  const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * safePageSize
  const rows = await query(`SELECT ${config.columns || '*'} FROM ${config.table} ORDER BY ${config.order} DESC LIMIT ${safePageSize} OFFSET ${offset}`)
  const count = await query(`SELECT COUNT(*) AS total FROM ${config.table}`)
  return { name, rows, page: safePage, pageSize: safePageSize, total: Number(count[0].total) }
}

module.exports = { getDataset, getOverview }
