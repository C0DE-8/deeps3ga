const { createGameMasterProposal, inferCategory } = require("./game-master.service");
const { keyFromName, parseJson, toJson } = require("./json");

const maxDevelopmentDelta = 3;

function getDb() {
  return require("../db");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function categoryDevelopment(category) {
  return {
    combat: "combat_development",
    survival: "survival_development",
    analysis: "analysis_development",
    magic: "magic_development",
    support: "support_development",
    leadership: "leadership_development",
    scouting: "scouting_development"
  }[category] || "survival_development";
}

function toColumn(field) {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function validateChapterProgress(run, proposal) {
  const target = Number(proposal.chapterProgress?.targetChapter || run.currentChapter + 1);
  if (!proposal.chapterProgress?.chapterComplete) return { advance: false };
  if (target !== Number(run.currentChapter) + 1) {
    throw new Error("Chapter progression rejected: chapters can only advance one at a time.");
  }
  if (target > 15) {
    return { advance: false };
  }
  return { advance: true, targetChapter: target };
}

function validateAbility(ability, character) {
  const tier = clamp(ability.powerTier || ability.power_tier || 1, 1, 5);
  if (character.level < 3 && tier > 1) {
    throw new Error("Ability rejected: power tier is too high for the current level.");
  }
  const reason = String(ability.reason || "");
  if (reason.length < 10) {
    throw new Error("Ability rejected: every ability needs a concrete reason.");
  }
  return {
    key: ability.key || keyFromName(ability.name),
    name: String(ability.name || "Unnamed Ability").slice(0, 140),
    description: String(ability.description || "An emerging capability.").slice(0, 1000),
    reason: reason.slice(0, 1000),
    powerTier: tier
  };
}

function validateTrait(trait) {
  return {
    key: trait.key || keyFromName(trait.name),
    name: String(trait.name || "Earned Trait").slice(0, 140),
    description: String(trait.description || "A persistent behavioral mark.").slice(0, 1000),
    reason: String(trait.reason || "Earned through repeated behavior.").slice(0, 1000)
  };
}

function boundedExperience(proposal) {
  const entries = Array.isArray(proposal.proposedExperience) ? proposal.proposedExperience : [];
  return clamp(entries.reduce((sum, entry) => sum + clamp(entry.amount, 0, 25), 0), 0, 35);
}

async function insertActionRequest(run, clientActionId, action) {
  try {
    await getDb().query(
      `INSERT INTO deep_saga_action_requests (run_id, client_action_id, action_text, status, run_version_before)
       VALUES (?, ?, ?, 'processing', ?)`,
      [run.runId, clientActionId, action, run.turnVersion]
    );
    return { duplicate: false };
  } catch (error) {
    const rows = await getDb().query(
      "SELECT * FROM deep_saga_action_requests WHERE run_id = ? AND client_action_id = ? LIMIT 1",
      [run.runId, clientActionId]
    );
    if (rows[0]) return { duplicate: true, request: rows[0] };
    throw error;
  }
}

async function applyCharacterProgress(run, character, proposal, action) {
  const category = proposal.sceneAssessment?.actionCategory || inferCategory(action);
  const developmentColumn = categoryDevelopment(category);
  const xp = boundedExperience(proposal);
  let experience = Number(character.experience) + xp;
  let level = Number(character.level);
  let experienceToNext = Number(character.experienceToNext);

  while (experience >= experienceToNext && level < 30) {
    experience -= experienceToNext;
    level += 1;
    experienceToNext += 50;
  }

  const healthDelta = clamp(proposal.proposedHealthChanges?.reduce?.((sum, entry) => sum + Number(entry.amount || 0), 0) || 0, -4, 2);
  const manaDelta = clamp(proposal.proposedManaChanges?.reduce?.((sum, entry) => sum + Number(entry.amount || 0), 0) || 0, -2, 2);
  const healthCurrent = clamp(Number(character.healthCurrent) + healthDelta, 0, character.healthMax);
  const manaCurrent = clamp(Number(character.manaCurrent) + manaDelta, 0, character.manaMax);
  const assignments = [
    "level = ?",
    "experience = ?",
    "experience_to_next = ?",
    "health_current = ?",
    "mana_current = ?",
    `${developmentColumn} = ${developmentColumn} + ?`,
    "updated_at = CURRENT_TIMESTAMP"
  ];
  const params = [level, experience, experienceToNext, healthCurrent, manaCurrent, maxDevelopmentDelta, run.runId];

  await getDb().query(`UPDATE deep_saga_character_states SET ${assignments.join(", ")} WHERE run_id = ?`, params);
  return { xp, category, level, healthCurrent, manaCurrent };
}

async function applyProposal(state, proposal, action) {
  const run = state.run;
  const characterResult = await applyCharacterProgress(run, state.character, proposal, action);
  const nextTurn = run.turnVersion + 1;

  for (const trait of proposal.proposedTraits.slice(0, 2).map(validateTrait)) {
    await getDb().query(
      `INSERT INTO deep_saga_traits (run_id, trait_key, name, description, reason, discovered_at_turn)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), reason = VALUES(reason)`,
      [run.runId, trait.key, trait.name, trait.description, trait.reason, nextTurn]
    );
  }

  for (const abilityRaw of proposal.proposedAbilities.slice(0, 1)) {
    const ability = validateAbility(abilityRaw, state.character);
    await getDb().query(
      `INSERT INTO deep_saga_abilities (run_id, ability_key, name, description, reason, power_tier, visible)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE description = VALUES(description), reason = VALUES(reason)`,
      [run.runId, ability.key, ability.name, ability.description, ability.reason, ability.powerTier]
    );
  }

  for (const change of proposal.relationshipChanges.slice(0, 5)) {
    const targetKey = String(change.targetKey || change.target_key || keyFromName(change.displayName)).slice(0, 100);
    const targetType = String(change.targetType || change.target_type || "npc").slice(0, 40);
    await getDb().query(
      `INSERT INTO deep_saga_relationships (run_id, target_type, target_key, display_name, trust, fear, respect, loyalty, hostility, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE trust = LEAST(100, GREATEST(-100, trust + VALUES(trust))), fear = LEAST(100, GREATEST(-100, fear + VALUES(fear))), respect = LEAST(100, GREATEST(-100, respect + VALUES(respect))), loyalty = LEAST(100, GREATEST(-100, loyalty + VALUES(loyalty))), hostility = LEAST(100, GREATEST(-100, hostility + VALUES(hostility))), notes = VALUES(notes)`,
      [run.runId, targetType, targetKey, String(change.displayName || targetKey).slice(0, 140), clamp(change.trust, -10, 10), clamp(change.fear, -10, 10), clamp(change.respect, -10, 10), clamp(change.loyalty, -10, 10), clamp(change.hostility, -10, 10), String(change.notes || "").slice(0, 1000)]
    );
  }

  for (const discovery of proposal.newDiscoveries.slice(0, 4)) {
    await getDb().query(
      `INSERT INTO deep_saga_discoveries (run_id, discovery_key, title, content, chapter_number, visibility)
       VALUES (?, ?, ?, ?, ?, 'player')
       ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      [run.runId, discovery.key || keyFromName(discovery.title), String(discovery.title || "Discovery").slice(0, 180), String(discovery.content || "").slice(0, 1500), run.currentChapter]
    );
  }

  for (const fact of proposal.canonicalFacts.slice(0, 4)) {
    await getDb().query(
      `INSERT INTO deep_saga_canonical_facts (run_id, fact_key, content, chapter_number, created_turn, tags_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      [run.runId, fact.key || keyFromName(fact.content), String(fact.content || "").slice(0, 1500), run.currentChapter, nextTurn, toJson(fact.tags || [])]
    );
  }

  for (const memory of proposal.memoryCandidates.slice(0, 3)) {
    await getDb().query(
      "INSERT INTO deep_saga_story_memories (run_id, content, importance, tags_json, created_turn) VALUES (?, ?, ?, ?, ?)",
      [run.runId, String(memory.content || "").slice(0, 1500), clamp(memory.importance, 1, 10), toJson(memory.tags || []), nextTurn]
    );
  }

  for (const thread of proposal.openThreadUpdates.slice(0, 3)) {
    await getDb().query(
      `INSERT INTO deep_saga_open_threads (run_id, thread_key, title, status, content, chapter_number)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), content = VALUES(content), updated_at = CURRENT_TIMESTAMP`,
      [run.runId, thread.key || keyFromName(thread.title), String(thread.title || "Open thread").slice(0, 180), String(thread.status || "open").slice(0, 40), String(thread.content || "").slice(0, 1500), run.currentChapter]
    );
  }

  for (const stateChange of proposal.worldStateChanges.slice(0, 3)) {
    await getDb().query(
      `INSERT INTO deep_saga_world_state (run_id, state_key, value_json, visibility)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = CURRENT_TIMESTAMP`,
      [run.runId, stateChange.key || keyFromName(stateChange.title), toJson(stateChange.value || {}), String(stateChange.visibility || "engine").slice(0, 40)]
    );
  }

  await getDb().query(
    "INSERT INTO deep_saga_story_messages (run_id, role, content, turn_number, metadata_json) VALUES (?, 'player', ?, ?, ?)",
    [run.runId, action, nextTurn, toJson({ client: true })]
  );
  await getDb().query(
    "INSERT INTO deep_saga_story_messages (run_id, role, content, turn_number, metadata_json) VALUES (?, 'gm', ?, ?, ?)",
    [run.runId, proposal.narration, nextTurn, toJson({ suggestedChoices: proposal.suggestedChoices, characterResult, sceneAssessment: proposal.sceneAssessment })]
  );

  const progress = validateChapterProgress(run, proposal);
  let statusUpdate = "";
  const statusParams = [];

  if (proposal.death?.occurred || characterResult.healthCurrent <= 0) {
    statusUpdate = ", status = 'dead', death_at = CURRENT_TIMESTAMP, death_reason = ?, death_location = ?";
    statusParams.push(proposal.death.reason || "The larval body could not survive the consequence.", proposal.death.location || state.character.location);
  } else if (proposal.endingCandidate && Number(run.currentChapter) >= 15) {
    statusUpdate = ", status = 'completed', completed_at = CURRENT_TIMESTAMP, ending_key = ?, ending_title = ?, ending_summary = ?";
    statusParams.push(proposal.endingCandidate.key || "the-last-ant", proposal.endingCandidate.title || "The Last Ant", proposal.endingCandidate.summary || proposal.narration.slice(0, 500));
  }

  const scene = String(proposal.sceneProgress?.nextScene || run.currentScene).slice(0, 120);
  const beat = String(proposal.sceneProgress?.nextBeat || run.storyBeat).slice(0, 120);
  const chapter = progress.advance ? progress.targetChapter : run.currentChapter;
  const params = [chapter, scene, beat, run.turnVersion + 1, ...statusParams, run.runId, run.turnVersion];

  const updateRows = await getDb().query(
    `UPDATE deep_saga_runs
        SET current_chapter = ?, current_scene = ?, story_beat = ?, turn_version = ?, last_played_at = CURRENT_TIMESTAMP${statusUpdate}
      WHERE run_id = ? AND turn_version = ?`,
    params
  );

  return { nextTurn, characterResult, updateRows };
}

async function resolvePlayerAction({ userId, runId, action, clientActionId, expectedVersion }) {
  const { buildStoryContext } = require("./story-guide.service");
  const { loadRunState } = require("./run.service");
  const state = await loadRunState(userId, runId);
  if (!state) {
    const error = new Error("Run not found.");
    error.status = 404;
    throw error;
  }
  if (state.run.status !== "active") {
    const error = new Error(`Run is ${state.run.status}; normal actions are blocked.`);
    error.status = 409;
    throw error;
  }
  if (expectedVersion != null && Number(expectedVersion) !== Number(state.run.turnVersion)) {
    const error = new Error("Run version is stale. Refresh before sending another action.");
    error.status = 409;
    throw error;
  }

  const request = await insertActionRequest(state.run, clientActionId, action);
  if (request.duplicate) {
    const response = parseJson(request.request.response_json, null);
    return { duplicate: true, response };
  }

  try {
    const recentMessages = state.messages.slice(-12);
    const context = await buildStoryContext({ ...state, recentMessages, action });
    const proposal = await createGameMasterProposal(context);
    await applyProposal(state, proposal, action);
    const response = await loadRunState(userId, runId);
    await getDb().query(
      "UPDATE deep_saga_action_requests SET status = 'completed', response_json = ?, completed_at = CURRENT_TIMESTAMP WHERE run_id = ? AND client_action_id = ?",
      [toJson(response), runId, clientActionId]
    );
    return { duplicate: false, response };
  } catch (error) {
    await getDb().query(
      "UPDATE deep_saga_action_requests SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE run_id = ? AND client_action_id = ?",
      [error.message, runId, clientActionId]
    );
    throw error;
  }
}

module.exports = {
  applyProposal,
  boundedExperience,
  categoryDevelopment,
  resolvePlayerAction,
  validateAbility,
  validateChapterProgress
};
