const db = require("../db");
const { getBookBySlug, getChapter, serializeBook } = require("./book.service");
const { parseJson, toJson } = require("./json");
const { startingState } = require("../books/ant-world/story-guide");

function bool(value) {
  return value === true || value === 1 || value === "1";
}

function serializeRun(row) {
  if (!row) return null;
  return {
    runId: row.run_id,
    userId: row.user_id,
    bookId: row.book_id,
    status: row.status,
    currentChapter: Number(row.current_chapter),
    currentScene: row.current_scene,
    storyBeat: row.story_beat,
    chapterFlags: parseJson(row.chapter_flags_json, {}),
    turnVersion: Number(row.turn_version || 0),
    startedAt: row.started_at,
    lastPlayedAt: row.last_played_at,
    completedAt: row.completed_at,
    deathAt: row.death_at,
    deathReason: row.death_reason,
    deathLocation: row.death_location,
    endingKey: row.ending_key,
    endingTitle: row.ending_title,
    endingSummary: row.ending_summary
  };
}

function serializeCharacter(row) {
  if (!row) return null;
  return {
    species: row.species,
    lifeStage: row.life_stage,
    level: Number(row.level),
    experience: Number(row.experience),
    experienceToNext: Number(row.experience_to_next),
    healthCurrent: Number(row.health_current),
    healthMax: Number(row.health_max),
    manaCurrent: Number(row.mana_current),
    manaMax: Number(row.mana_max),
    manaKnown: bool(row.mana_known),
    conditionText: row.condition_text,
    evolutionState: parseJson(row.evolution_state_json, {}),
    location: row.location,
    territory: row.territory,
    humanMemoriesRetained: bool(row.human_memories_retained),
    physicalDevelopment: Number(row.physical_development),
    combatDevelopment: Number(row.combat_development),
    magicDevelopment: Number(row.magic_development),
    analysisDevelopment: Number(row.analysis_development),
    leadershipDevelopment: Number(row.leadership_development),
    supportDevelopment: Number(row.support_development),
    survivalDevelopment: Number(row.survival_development),
    scoutingDevelopment: Number(row.scouting_development),
    predatorDevelopment: Number(row.predator_development),
    soulDevelopment: Number(row.soul_development)
  };
}

async function createAntWorldRun(userId) {
  const book = await getBookBySlug("ant-world");
  if (!book) throw new Error("Ant World book has not been seeded. Run migrations first.");

  await db.query(
    `INSERT INTO deep_saga_runs (user_id, book_id, current_chapter, current_scene, story_beat, chapter_flags_json, last_played_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [userId, book.bookId, startingState.run.currentChapter, startingState.run.currentScene, startingState.run.storyBeat, toJson({})]
  );
  const runRow = (await db.query("SELECT * FROM deep_saga_runs WHERE user_id = ? ORDER BY run_id DESC LIMIT 1", [userId]))[0];
  const runId = runRow.run_id;
  const c = startingState.character;

  await db.query(
    `INSERT INTO deep_saga_character_states
      (run_id, species, life_stage, level, experience, experience_to_next, health_current, health_max, mana_current, mana_max, mana_known, condition_text, evolution_state_json, location, territory, human_memories_retained, physical_development, combat_development, magic_development, analysis_development, leadership_development, support_development, survival_development, scouting_development, predator_development, soul_development)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [runId, c.species, c.lifeStage, c.level, c.experience, c.experienceToNext, c.healthCurrent, c.healthMax, c.manaCurrent, c.manaMax, c.manaKnown ? 1 : 0, c.conditionText, toJson(c.evolutionState), c.location, c.territory, 1, c.physicalDevelopment, c.combatDevelopment, c.magicDevelopment, c.analysisDevelopment, c.leadershipDevelopment, c.supportDevelopment, c.survivalDevelopment, c.scoutingDevelopment, c.predatorDevelopment, c.soulDevelopment]
  );

  for (const discovery of startingState.discoveries) {
    await db.query(
      `INSERT INTO deep_saga_discoveries (run_id, discovery_key, title, content, chapter_number, visibility)
       VALUES (?, ?, ?, ?, 1, 'player')`,
      [runId, discovery.key, discovery.title, discovery.content]
    );
  }

  for (const relationship of startingState.relationships) {
    await db.query(
      `INSERT INTO deep_saga_relationships (run_id, target_type, target_key, display_name, trust, fear, respect, loyalty, hostility, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [runId, relationship.targetType, relationship.targetKey, relationship.displayName, relationship.trust, relationship.fear, relationship.respect, relationship.loyalty, relationship.hostility, relationship.notes]
    );
  }

  for (const state of startingState.worldState) {
    await db.query(
      `INSERT INTO deep_saga_world_state (run_id, state_key, value_json, visibility) VALUES (?, ?, ?, ?)`,
      [runId, state.key, toJson(state.value), state.visibility]
    );
  }

  await db.query(
    `INSERT INTO deep_saga_story_messages (run_id, role, content, turn_number, metadata_json)
     VALUES (?, 'gm', ?, 0, ?)`,
    [runId, startingState.openingNarration.join("\n\n"), toJson({ suggestedChoices: startingState.openingChoices, opening: true })]
  );

  return getRunForUser(userId, runId);
}

async function listRunsForUser(userId) {
  const rows = await db.query(
    `SELECT r.*, b.slug, b.title, b.book_number, b.world, b.status AS book_status, b.genre_json, b.description, b.version, b.cover_config_json
       FROM deep_saga_runs r
       JOIN deep_saga_books b ON b.book_id = r.book_id
      WHERE r.user_id = ?
      ORDER BY r.last_played_at DESC, r.started_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    ...serializeRun(row),
    book: serializeBook({
      book_id: row.book_id,
      slug: row.slug,
      title: row.title,
      book_number: row.book_number,
      world: row.world,
      status: row.book_status,
      genre_json: row.genre_json,
      description: row.description,
      version: row.version,
      cover_config_json: row.cover_config_json
    })
  }));
}

async function getRunForUser(userId, runId) {
  const rows = await db.query(
    `SELECT r.*, b.slug, b.title, b.book_number, b.world, b.status AS book_status, b.genre_json, b.description, b.version, b.cover_config_json
       FROM deep_saga_runs r
       JOIN deep_saga_books b ON b.book_id = r.book_id
      WHERE r.user_id = ? AND r.run_id = ?
      LIMIT 1`,
    [userId, runId]
  );
  const row = rows[0];
  if (!row) return null;
  const run = serializeRun(row);
  const book = serializeBook({
    book_id: row.book_id,
    slug: row.slug,
    title: row.title,
    book_number: row.book_number,
    world: row.world,
    status: row.book_status,
    genre_json: row.genre_json,
    description: row.description,
    version: row.version,
    cover_config_json: row.cover_config_json
  });
  const [characterRows, messageRows] = await Promise.all([
    db.query("SELECT * FROM deep_saga_character_states WHERE run_id = ? LIMIT 1", [runId]),
    db.query("SELECT * FROM deep_saga_story_messages WHERE run_id = ? ORDER BY turn_number ASC, message_id ASC LIMIT 120", [runId])
  ]);
  const chapter = await getChapter(book.bookId, run.currentChapter);
  return {
    run,
    book,
    chapter,
    character: serializeCharacter(characterRows[0]),
    messages: messageRows.map((message) => ({
      id: message.message_id,
      role: message.role,
      content: message.content,
      turnNumber: Number(message.turn_number),
      metadata: parseJson(message.metadata_json, {})
    }))
  };
}

async function loadRunState(userId, runId) {
  const bundle = await getRunForUser(userId, runId);
  if (!bundle) return null;

  const [discoveries, relationships, facts, memories, threads, worldState, traits, abilities, resources, events] = await Promise.all([
    db.query("SELECT * FROM deep_saga_discoveries WHERE run_id = ? ORDER BY discovery_id", [runId]),
    db.query("SELECT * FROM deep_saga_relationships WHERE run_id = ? ORDER BY relationship_id", [runId]),
    db.query("SELECT * FROM deep_saga_canonical_facts WHERE run_id = ? ORDER BY fact_id DESC LIMIT 40", [runId]),
    db.query("SELECT * FROM deep_saga_story_memories WHERE run_id = ? ORDER BY importance DESC, memory_id DESC LIMIT 20", [runId]),
    db.query("SELECT * FROM deep_saga_open_threads WHERE run_id = ? AND status = 'open' ORDER BY thread_id DESC LIMIT 20", [runId]),
    db.query("SELECT * FROM deep_saga_world_state WHERE run_id = ? ORDER BY state_key", [runId]),
    db.query("SELECT * FROM deep_saga_traits WHERE run_id = ? ORDER BY trait_id", [runId]),
    db.query("SELECT * FROM deep_saga_abilities WHERE run_id = ? AND visible = 1 ORDER BY ability_id", [runId]),
    db.query("SELECT * FROM deep_saga_resources WHERE run_id = ? AND quantity > 0 ORDER BY resource_id", [runId]),
    db.query("SELECT * FROM deep_saga_story_events WHERE run_id = ? ORDER BY event_id DESC LIMIT 40", [runId])
  ]);

  return {
    ...bundle,
    discoveries: discoveries.map((row) => ({ key: row.discovery_key, title: row.title, content: row.content, chapterNumber: Number(row.chapter_number) })),
    relationships: relationships.map((row) => ({ targetType: row.target_type, targetKey: row.target_key, displayName: row.display_name, trust: Number(row.trust), fear: Number(row.fear), respect: Number(row.respect), loyalty: Number(row.loyalty), hostility: Number(row.hostility), notes: row.notes })),
    facts: facts.map((row) => ({ key: row.fact_key, content: row.content, chapterNumber: Number(row.chapter_number), tags: parseJson(row.tags_json, []) })),
    memories: memories.map((row) => ({ id: row.memory_id, content: row.content, importance: Number(row.importance), tags: parseJson(row.tags_json, []) })),
    threads: threads.map((row) => ({ key: row.thread_key, title: row.title, status: row.status, content: row.content, chapterNumber: Number(row.chapter_number) })),
    worldState: worldState.map((row) => ({ key: row.state_key, value: parseJson(row.value_json, {}), visibility: row.visibility })),
    traits: traits.map((row) => ({ key: row.trait_key, name: row.name, description: row.description, reason: row.reason })),
    abilities: abilities.map((row) => ({ key: row.ability_key, name: row.name, description: row.description, reason: row.reason, powerTier: Number(row.power_tier) })),
    resources: resources.map((row) => ({ key: row.resource_key, name: row.name, quantity: Number(row.quantity), storageType: row.storage_type, notes: row.notes })),
    events: events.map((row) => ({ key: row.event_key, type: row.event_type, title: row.title, content: row.content, chapterNumber: Number(row.chapter_number), turnNumber: Number(row.turn_number), metadata: parseJson(row.metadata_json, {}) }))
  };
}

module.exports = {
  createAntWorldRun,
  getRunForUser,
  listRunsForUser,
  loadRunState,
  serializeCharacter,
  serializeRun
};
