function fallbackScene(player) {
  const body = player.currentBody || {};
  const race = body.race || "monster";

  return {
    narration: `You wake beneath a ceiling of black stone, no longer human. Your memories arrive first: a normal life, a sudden death, then the cold certainty that this body is yours now. The dungeon air tastes like iron. Your new ${race} instincts twitch before your human thoughts can name them.`,
    choices: [
      `Examine your ${race} body and test what it can do.`,
      "Stay silent and listen for nearby enemies.",
      "Search the chamber for a hidden path or useful remains.",
      "Move toward the deepest sound and risk an early fight."
    ]
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

function parseScene(text, player) {
  try {
    const parsed = JSON.parse(text);

    if (parsed.narration && Array.isArray(parsed.choices) && parsed.choices.length === 4) {
      return {
        narration: String(parsed.narration),
        choices: parsed.choices.map(String).slice(0, 4)
      };
    }
  } catch {
    return fallbackScene(player);
  }

  return fallbackScene(player);
}

async function createOpeningScene(player) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "#") {
    return fallbackScene(player);
  }

  const body = player.currentBody || {};
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = {
    playerId: player.playerId,
    run: player.currentRun,
    cycleClears: player.cycleClears,
    body,
    rules: [
      "The player begins as a normal human who dies and reincarnates as a monster.",
      "The world has five dungeons with three floors each.",
      "Every third floor has a boss.",
      "Death before clearing the fifth dungeon resets the body, level, skills, powers, equipment, and evolution progress. Memories remain.",
      "After a completed run, the next final boss is the player's previous completed self.",
      "Always provide exactly four meaningful choices that fit the player's body and situation."
    ]
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      instructions: "You are the Deep Saga narrator. Write in second person, like the player is reading their own anime reincarnation story. Return JSON only with keys narration and choices.",
      input: JSON.stringify(prompt)
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return fallbackScene(player);
  }

  return parseScene(extractText(payload), player);
}

module.exports = {
  createOpeningScene,
  fallbackScene
};
