const { buildGameMasterPrompt } = require("../config/prompts");
const db = require("../db");
const { applyCharacterResourceDeltas, awardCharacterSkill, createLegacyHeroForPlayer, getPlayerSheet } = require("./player.service");

function buildFallbackScene(player, playerAction) {
  const body = player.currentBody || {};
  const race = body.race || "monster";
  const action = String(playerAction || "").trim();

  return {
    narration: action
      ? `You try to ${action}. The dungeon answers with silence first, then with pressure, as if the stone itself is judging whether your new ${race} body can survive the choice.`
      : `You wake beneath a ceiling of black stone, no longer human. Your memories arrive first: a normal life, a sudden death, then the cold certainty that this body is yours now. The dungeon air tastes like iron. Your new ${race} instincts twitch before your human thoughts can name them.`,
    choices: [
      {
        title: `Test the limits of your ${race} body`,
        text: "Move carefully and learn what this reincarnated form can do before the Dungeon notices too much.",
        action: `I quietly test what my ${race} body can do without drawing attention.`,
        direction: "survival"
      },
      {
        title: "Listen before moving deeper",
        text: "Stay low, let the chamber breathe around you, and identify the nearest sound before choosing a path.",
        action: "I stay still and listen for movement before stepping deeper into the chamber.",
        direction: "cautious"
      },
      {
        title: "Search the floor for signs",
        text: "Look for remains, tools, blood trails, claw marks, or anything that explains what hunts here.",
        action: "I search the floor for remains, tools, or signs of danger.",
        direction: "investigate"
      },
      {
        title: "Move toward the nearest sound",
        text: "Risk being seen in exchange for learning what lives beyond the dark edge of the chamber.",
        action: "I move toward the nearest sound and prepare to react if something sees me.",
        direction: "bold"
      }
    ],
    aiNarrated: false,
    source: "fallback"
  };
}

function extractText(payload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  const output = payload.output || [];

  for (const item of output) {
    for (const content of item.content || []) {
      if (content.text) {
        return content.text;
      }
    }
  }

  return "";
}

function normalizeChoice(choice, index) {
  const fallbackDirection = `Path ${index + 1}`;

  if (typeof choice === "string") {
    const text = choice.trim();
    if (!text) return null;

    return {
      id: `choice-${index + 1}`,
      title: text,
      text: "",
      action: text,
      direction: fallbackDirection
    };
  }

  if (choice && typeof choice === "object") {
    const title = String(choice.title || choice.label || choice.text || choice.action || "").trim();
    const text = String(choice.text || choice.description || choice.detail || "").trim();
    const action = String(choice.action || choice.text || title || "").trim();
    const direction = String(choice.direction || choice.type || fallbackDirection).trim();
    const id = String(choice.id || `choice-${index + 1}`).trim();

    if (!title && !text && !action) return null;

    return {
      id: id || `choice-${index + 1}`,
      title: title || action || text,
      text: text && text !== title ? text : "",
      action: action || title || text,
      direction: direction || fallbackDirection
    };
  }

  return null;
}

function normalizeChoices(choices) {
  if (!Array.isArray(choices)) {
    return [];
  }

  return choices
    .map((choice, index) => normalizeChoice(choice, index))
    .filter(Boolean)
    .slice(0, 5);
}

function parseScene(text) {
  const parsed = JSON.parse(text);
  const narration = String(parsed.narration || parsed.story || "").trim();
  const choices = normalizeChoices(parsed.choices);

  if (!narration || choices.length < 3) {
    throw new Error("AI narrator returned an incomplete scene.");
  }

  return {
    narration,
    choices,
    recordChanges: Array.isArray(parsed.recordChanges) ? parsed.recordChanges : [],
    stateChanges: parsed.stateChanges && typeof parsed.stateChanges === "object" ? parsed.stateChanges : {},
    memoryUpdates: Array.isArray(parsed.memoryUpdates) ? parsed.memoryUpdates : [],
    locationNames: Array.isArray(parsed.locationNames) ? parsed.locationNames : [],
    aiNarrated: true,
    source: "openai"
  };
}

function normalizeRecentMessages(recentMessages) {
  if (!Array.isArray(recentMessages)) {
    return [];
  }

  return recentMessages
    .slice(-12)
    .map((message) => ({
      speaker: String(message.speaker || "").slice(0, 24),
      text: String(message.message_text || message.text || "").slice(0, 1600)
    }))
    .filter((message) => message.speaker && message.text);
}

async function loadRecentStoryMessages(player, limit = 12) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 12), 80));
  const rows = await db.query(
    `SELECT speaker, message_text
       FROM story_messages
      WHERE player_id = ? AND run_number = ?
      ORDER BY id DESC
      LIMIT ${safeLimit}`,
    [player.playerId, Number(player.currentRun || 1)]
  );

  return rows.reverse().map((message) => ({
    speaker: message.speaker,
    text: message.message_text
  }));
}

async function loadStoryHistory(player, limit = 80) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 80), 120));
  const rows = await db.query(
    `SELECT id, speaker, message_text, choices_json, state_changes_json, record_changes_json, memory_updates_json, created_at
       FROM story_messages
      WHERE player_id = ? AND run_number = ?
      ORDER BY id DESC
      LIMIT ${safeLimit}`,
    [player.playerId, Number(player.currentRun || 1)]
  );

  return rows.reverse().map((message) => ({
    id: `sql-${message.id}`,
    speaker: message.speaker,
    message_text: message.message_text,
    choices_json: typeof message.choices_json === "string" ? JSON.parse(message.choices_json || "[]") : (message.choices_json || []),
    state_changes_json: typeof message.state_changes_json === "string" ? JSON.parse(message.state_changes_json || "{}") : (message.state_changes_json || {}),
    record_changes_json: typeof message.record_changes_json === "string" ? JSON.parse(message.record_changes_json || "[]") : (message.record_changes_json || []),
    memory_updates_json: typeof message.memory_updates_json === "string" ? JSON.parse(message.memory_updates_json || "[]") : (message.memory_updates_json || []),
    created_at: message.created_at
  }));
}

async function loadImportantMemories(player, limit = 12) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 12), 40));
  const rows = await db.query(
    `SELECT memory_type, memory_text, remembered_across_lives
       FROM story_memory
      WHERE player_id = ? AND (run_number = ? OR remembered_across_lives = 1)
      ORDER BY importance DESC, id DESC
      LIMIT ${safeLimit}`,
    [player.playerId, Number(player.currentRun || 1)]
  );

  return rows.map((memory) => ({
    type: memory.memory_type,
    text: memory.memory_text,
    rememberedAcrossLives: Boolean(Number(memory.remembered_across_lives || 0))
  }));
}

function buildContext(player, playerAction, recentMessages = [], importantMemories = [], knownSkills = []) {
  const body = player.currentBody || {};
  const character = player.activeCharacter || {};
  const runtime = player.floorRuntime || {};
  const action = String(playerAction || "").trim();
  const normalizedRecentMessages = normalizeRecentMessages(recentMessages);
  const dungeonNumber = Number(runtime.dungeonNumber || character.dungeon || body.dungeon || 1);
  const floorNumber = Number(runtime.floorNumber || character.floor || body.floor || 1);

  return {
    player: {
      playerId: player.playerId,
      narratorPersona: player.narratorPersona || "ADMIN",
      run: player.currentRun,
      cycleClears: player.cycleClears
    },
    currentBody: body,
    activeCharacter: character,
    knownSkills: knownSkills.map((skill) => ({
      id: skill.id,
      key: skill.key,
      name: skill.name,
      family: skill.family,
      type: skill.type,
      rarity: skill.rarity,
      level: skill.level,
      description: skill.description
    })),
    currentPosition: {
      dungeon: dungeonNumber,
      floor: floorNumber,
      canonicalDungeonLabel: runtime.dungeonLabel || `Dungeon ${dungeonNumber}`,
      canonicalFloorLabel: runtime.floorLabel || `Dungeon ${dungeonNumber} Floor ${floorNumber}`,
      aiDungeonName: runtime.dungeonAiName || null,
      aiFloorName: runtime.floorAiName || null,
      floorRole: runtime.floorRole || (floorNumber === 3 ? "boss" : floorNumber === 1 ? "introduction" : "main_danger"),
      isBossFloor: Boolean(runtime.isBossFloor || floorNumber === 3),
      isFinalBossFloor: Boolean(runtime.isFinalBossFloor || (dungeonNumber === 5 && floorNumber === 3)),
      totalDungeons: 5,
      floorsPerDungeon: 3,
      status: character.status || body.status || "newly reincarnated"
    },
    sceneState: {
      isOpeningScene: !action && normalizedRecentMessages.length === 0,
      hasRecentStory: normalizedRecentMessages.length > 0
    },
    memoryLog: [
      ...(Array.isArray(player.memoryLog) ? player.memoryLog.slice(-20) : []),
      ...importantMemories.map((memory) => memory.text)
    ].slice(-32),
    importantMemories,
    recentMessages: normalizedRecentMessages,
    playerAction: action || "Begin the first scene.",
    worldRules: [
      "Deep Saga is a continuous dark fantasy reincarnation text RPG.",
      "You are the Game Master and narrator, not just a prose writer.",
      "The player begins as a human who died in the real world and reincarnated inside Deep Saga.",
      "The player may attempt any action, but player statements are attempts, not facts.",
      "Do not grant godhood, infinite gold, instant boss kills, or skipped floors unless saved state already allows it.",
      "Use the saved body, dungeon, floor, skills, memories, and current position as truth.",
      "Skills are earned from repeated actions, rare discoveries, quest conditions, survival pressure, or impossible achievements.",
      "If a skill is earned, return it in stateChanges.skillsUnlocked and explain it in narration.",
      "The world has five dungeons with three floors each. Floor 3 is the boss floor.",
      "Every reply must resolve the player action, continue the current scene, and provide 3 to 5 meaningful choices.",
      "Choices must be specific story actions, not generic commands.",
      "Return JSON only."
    ]
  };
}

function normalizeSkillUnlocks(stateChanges) {
  const raw = [
    ...(Array.isArray(stateChanges.skillsUnlocked) ? stateChanges.skillsUnlocked : []),
    ...(Array.isArray(stateChanges.skillUnlocks) ? stateChanges.skillUnlocks : []),
    ...(Array.isArray(stateChanges.newSkills) ? stateChanges.newSkills : [])
  ];

  return raw
    .map((skill) => {
      if (typeof skill === "string") {
        return { name: skill };
      }
      return skill && typeof skill === "object" ? skill : null;
    })
    .filter((skill) => String(skill?.name || skill?.skillName || "").trim())
    .slice(0, 3);
}

function resourceRecordChanges(resourceResult) {
  if (!resourceResult?.before || !resourceResult?.after || !resourceResult?.deltas) {
    return [];
  }

  const before = resourceResult.before;
  const after = resourceResult.after;
  const deltas = resourceResult.deltas;
  const records = [];
  const formatDelta = (value) => value > 0 ? `+${value}` : `${value}`;

  if (deltas.hp) {
    records.push({
      type: "resource",
      text: `HP ${formatDelta(deltas.hp)}: ${before.hp}/${before.max_hp} -> ${after.hp}/${after.max_hp}`
    });
  }

  if (deltas.mana) {
    records.push({
      type: "resource",
      text: `Mana ${formatDelta(deltas.mana)}: ${before.mana}/${before.max_mana} -> ${after.mana}/${after.max_mana}`
    });
  }

  if (deltas.stamina) {
    records.push({
      type: "resource",
      text: `Stamina ${formatDelta(deltas.stamina)}: ${before.stamina}/${before.max_stamina} -> ${after.stamina}/${after.max_stamina}`
    });
  }

  if (deltas.gold) {
    records.push({
      type: "resource",
      text: `Gold ${formatDelta(deltas.gold)}: ${before.gold} -> ${after.gold}`
    });
  }

  return records;
}

function actionLooksLikeAppraisal(action) {
  return /\b(apprais(?:e|al|ing)?|analyz(?:e|e|ing)|inspect|identify|study|self-analysis|read\s+more|see\s+more\s+information)\b/i.test(String(action || ""));
}

function stateHasResourceDelta(stateChanges) {
  return Boolean(
    Number(stateChanges.hpDelta || stateChanges.playerHpDelta || 0) ||
    Number(stateChanges.manaDelta || stateChanges.playerManaDelta || 0) ||
    Number(stateChanges.staminaDelta || stateChanges.playerStaminaDelta || 0) ||
    Number(stateChanges.goldDelta || 0)
  );
}

async function applyAcceptedStateChanges(context, scene) {
  const characterId = context.activeCharacter?.id || null;
  const stateChanges = scene.stateChanges || {};

  if (!characterId) {
    return;
  }

  if (!stateHasResourceDelta(stateChanges) && actionLooksLikeAppraisal(context.playerAction)) {
    stateChanges.playerManaDelta = -1;
    scene.stateChanges = stateChanges;
  }

  const resourceResult = await applyCharacterResourceDeltas(characterId, {
    hp: stateChanges.hpDelta ?? stateChanges.playerHpDelta,
    mana: stateChanges.manaDelta ?? stateChanges.playerManaDelta,
    stamina: stateChanges.staminaDelta ?? stateChanges.playerStaminaDelta,
    gold: stateChanges.goldDelta
  });

  if (resourceResult) {
    scene.appliedResources = resourceResult;
    scene.recordChanges = [
      ...(scene.recordChanges || []),
      ...resourceRecordChanges(resourceResult)
    ];
  }

  const unlocked = [];
  for (const skill of normalizeSkillUnlocks(stateChanges)) {
    const awarded = await awardCharacterSkill(characterId, skill);
    if (awarded) {
      unlocked.push(awarded);
    }
  }

  if (unlocked.length) {
    scene.appliedSkills = unlocked;
    scene.recordChanges = [
      ...(scene.recordChanges || []),
      ...unlocked.map((skill) => ({
        type: "skill",
        text: `${skill.name} awakened`
      }))
    ];
  }
}

async function saveStoryTurn(context, playerAction, scene) {
  const playerId = context.player?.playerId;
  const runNumber = Number(context.player?.run || 1);
  const characterId = context.activeCharacter?.id || null;
  const dungeonNumber = Number(context.currentPosition?.dungeon || 1);
  const floorNumber = Number(context.currentPosition?.floor || 1);
  const action = String(playerAction || "").trim();

  if (action) {
    await db.execute(
      `INSERT INTO story_messages (player_id, run_number, character_id, dungeon_number, floor_number, speaker, message_text)
       VALUES (?, ?, ?, ?, ?, 'player', ?)`,
      [playerId, runNumber, characterId, dungeonNumber, floorNumber, action]
    );
  }

  await db.execute(
    `INSERT INTO story_messages (player_id, run_number, character_id, dungeon_number, floor_number, speaker, message_text, choices_json, state_changes_json, record_changes_json, memory_updates_json)
     VALUES (?, ?, ?, ?, ?, 'narrator', ?, ?, ?, ?, ?)`,
    [
      playerId,
      runNumber,
      characterId,
      dungeonNumber,
      floorNumber,
      scene.narration,
      JSON.stringify(scene.choices || []),
      JSON.stringify(scene.stateChanges || {}),
      JSON.stringify(scene.recordChanges || []),
      JSON.stringify(scene.memoryUpdates || [])
    ]
  );

  await saveMemoryUpdates(context, scene.memoryUpdates || []);
}

async function saveMemoryUpdates(context, memoryUpdates) {
  const playerId = context.player?.playerId;
  const runNumber = Number(context.player?.run || 1);
  const characterId = context.activeCharacter?.id || null;

  for (const memory of memoryUpdates.slice(0, 10)) {
    const text = String(memory.text || memory.summary || memory).trim();
    if (!text) continue;

    await db.execute(
      `INSERT INTO story_memory (player_id, run_number, character_id, memory_type, memory_text, facts_json, importance, remembered_across_lives)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        playerId,
        runNumber,
        characterId,
        String(memory.type || "story").slice(0, 60),
        text.slice(0, 4000),
        JSON.stringify(memory.facts || {}),
        Number(memory.importance || 1),
        memory.rememberedAcrossLives ? 1 : 0
      ]
    );
  }
}

async function maybeCreateLegacyHero(context, scene) {
  const stateChanges = scene.stateChanges || {};
  const runCompleted = Boolean(stateChanges.runCompleted || scene.runCompleted);
  const isFinalBossFloor = Boolean(context.currentPosition?.isFinalBossFloor);

  if (!runCompleted || !isFinalBossFloor) {
    return null;
  }

  return createLegacyHeroForPlayer(context.player.playerId, Number(context.player.run || 1));
}

async function saveAiLocationNames(context, scene) {
  const names = Array.isArray(scene.locationNames) ? scene.locationNames : [];
  if (!names.length) return;

  const dungeonNumber = Number(context.currentPosition?.dungeon || 1);
  const floorNumber = Number(context.currentPosition?.floor || 1);

  for (const entry of names.slice(0, 5)) {
    const type = String(entry.type || "").trim().toLowerCase();
    const name = String(entry.name || "").trim().slice(0, 160);
    const sourceText = String(entry.sourceText || entry.source || "").trim().slice(0, 1000);

    if (!["dungeon", "floor", "boss", "area"].includes(type) || !name) {
      continue;
    }

    await db.execute(
      "INSERT INTO ai_location_names (player_id, run_number, dungeon_number, floor_number, name_type, ai_name, source_text, accepted) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      [context.player?.playerId || null, Number(context.player?.run || 1), dungeonNumber, type === "dungeon" ? null : floorNumber, type, name, sourceText || null]
    );

    if (type === "dungeon") {
      await db.execute(
        "UPDATE dungeons SET ai_name = ?, ai_name_note = ? WHERE dungeon_number = ?",
        [name, sourceText || null, dungeonNumber]
      );
    }

    if (type === "floor") {
      await db.execute(
        "UPDATE dungeon_floors SET ai_name = ?, ai_name_note = ? WHERE dungeon_number = ? AND floor_number = ?",
        [name, sourceText || null, dungeonNumber, floorNumber]
      );
    }
  }
}

async function callOpenAi(context) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const instructions = buildGameMasterPrompt({
    persona: context.player?.narratorPersona || process.env.DEEP_SAGA_PERSONA || "ADMIN",
    context
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      instructions,
      input: JSON.stringify(context)
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI narration request failed.");
  }

  return parseScene(extractText(payload));
}

async function createStoryScene(player, playerAction, recentMessages) {
  const sqlRecentMessages = await loadRecentStoryMessages(player);
  const importantMemories = await loadImportantMemories(player);
  const sheet = await getPlayerSheet(player.playerId);
  const context = buildContext(
    player,
    playerAction,
    sqlRecentMessages.length ? sqlRecentMessages : recentMessages,
    importantMemories,
    sheet?.skills || []
  );

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "#") {
    if (process.env.ALLOW_STATIC_NARRATOR_FALLBACK === "true") {
      const fallbackScene = buildFallbackScene(player, playerAction);
      await saveStoryTurn(context, playerAction, fallbackScene);
      return fallbackScene;
    }

    throw new Error("OPENAI_API_KEY is required because Deep Saga uses AI as the narrator.");
  }

  const scene = await callOpenAi(context);
  await applyAcceptedStateChanges(context, scene);
  await saveAiLocationNames(context, scene);
  await saveStoryTurn(context, playerAction, scene);
  const legacyHero = await maybeCreateLegacyHero(context, scene);
  if (legacyHero) {
    scene.legacyHero = legacyHero;
  }
  return scene;
}

module.exports = {
  buildContext,
  buildFallbackScene,
  createOpeningScene: createStoryScene,
  createStoryScene,
  loadRecentStoryMessages,
  loadStoryHistory
};
