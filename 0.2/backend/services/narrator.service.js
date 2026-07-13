const { buildGameMasterPrompt } = require("../config/prompts");

function buildFallbackScene(player, playerAction) {
  const body = player.currentBody || {};
  const race = body.race || "monster";
  const action = String(playerAction || "").trim();

  return {
    narration: action
      ? `You try to ${action}. The dungeon answers with silence first, then with pressure, as if the stone itself is judging whether your new ${race} body can survive the choice.`
      : `You wake beneath a ceiling of black stone, no longer human. Your memories arrive first: a normal life, a sudden death, then the cold certainty that this body is yours now. The dungeon air tastes like iron. Your new ${race} instincts twitch before your human thoughts can name them.`,
    choices: [
      `Test what your ${race} body can do without making noise.`,
      "Listen for movement before stepping deeper into the chamber.",
      "Search the floor for remains, tools, or signs of danger.",
      "Move toward the nearest sound and risk being seen."
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

function normalizeChoices(choices) {
  if (!Array.isArray(choices)) {
    return [];
  }

  return choices
    .map((choice) => {
      if (typeof choice === "string") {
        return choice;
      }

      if (choice && typeof choice === "object") {
        return choice.action || choice.text || choice.title || "";
      }

      return "";
    })
    .map((choice) => String(choice).trim())
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

function buildContext(player, playerAction, recentMessages = []) {
  const body = player.currentBody || {};
  const action = String(playerAction || "").trim();
  const normalizedRecentMessages = normalizeRecentMessages(recentMessages);

  return {
    player: {
      playerId: player.playerId,
      narratorPersona: player.narratorPersona || "ADMIN",
      run: player.currentRun,
      cycleClears: player.cycleClears
    },
    currentBody: body,
    currentPosition: {
      dungeon: Number(body.dungeon || 1),
      floor: Number(body.floor || 1),
      status: body.status || "newly reincarnated"
    },
    sceneState: {
      isOpeningScene: !action && normalizedRecentMessages.length === 0,
      hasRecentStory: normalizedRecentMessages.length > 0
    },
    memoryLog: Array.isArray(player.memoryLog) ? player.memoryLog.slice(-20) : [],
    recentMessages: normalizedRecentMessages,
    playerAction: action || "Begin the first scene.",
    worldRules: [
      "Deep Saga is a continuous dark fantasy reincarnation text RPG.",
      "You are the Game Master and narrator, not just a prose writer.",
      "The player begins as a human who died in the real world and reincarnated inside Deep Saga.",
      "The player may attempt any action, but player statements are attempts, not facts.",
      "Do not grant godhood, infinite gold, instant boss kills, or skipped floors unless saved state already allows it.",
      "Use the saved body, dungeon, floor, skills, memories, and current position as truth.",
      "The world has five dungeons with three floors each. Floor 3 is the boss floor.",
      "Every reply must resolve the player action, continue the current scene, and provide 3 to 5 meaningful choices.",
      "Choices must be specific story actions, not generic commands.",
      "Return JSON only."
    ]
  };
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
  const context = buildContext(player, playerAction, recentMessages);

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "#") {
    if (process.env.ALLOW_STATIC_NARRATOR_FALLBACK === "true") {
      return buildFallbackScene(player, playerAction);
    }

    throw new Error("OPENAI_API_KEY is required because Deep Saga uses AI as the narrator.");
  }

  return callOpenAi(context);
}

module.exports = {
  buildContext,
  buildFallbackScene,
  createOpeningScene: createStoryScene,
  createStoryScene
};
