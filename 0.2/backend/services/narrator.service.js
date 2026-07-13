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

function buildContext(player, playerAction) {
  const body = player.currentBody || {};

  return {
    player: {
      playerId: player.playerId,
      run: player.currentRun,
      cycleClears: player.cycleClears
    },
    currentBody: body,
    currentPosition: {
      dungeon: Number(body.dungeon || 1),
      floor: Number(body.floor || 1),
      status: body.status || "newly reincarnated"
    },
    memoryLog: Array.isArray(player.memoryLog) ? player.memoryLog.slice(-20) : [],
    playerAction: String(playerAction || "").trim() || "Begin or continue the current scene.",
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
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      instructions: [
        "You are the sole Game Master and narrator of Deep Saga.",
        "Write in second person, like the player is reading and shaping a dark fantasy reincarnation novel.",
        "Never break character with backend or system wording.",
        "Use the supplied saved state as the source of truth.",
        "Return exactly one JSON object with keys: narration, choices, stateChanges, recordChanges, memoryUpdates.",
        "choices must be an array of 3 to 5 strings."
      ].join(" "),
      input: JSON.stringify(context)
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI narration request failed.");
  }

  return parseScene(extractText(payload));
}

async function createStoryScene(player, playerAction) {
  const context = buildContext(player, playerAction);

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
