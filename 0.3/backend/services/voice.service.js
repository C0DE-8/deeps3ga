const { personas } = require("../config/prompts");

const voiceByMode = {
  male: "onyx",
  female: "nova"
};

function toneInstructions(personaKey, voiceMode) {
  const persona = personas[personaKey] || personas.ADMIN;
  const voiceName = voiceMode === "female" ? "female narrator" : "male narrator";

  return [
    `Read as a ${voiceName} for an interactive dark fantasy reincarnation novel.`,
    `Narrator role: ${persona.role}.`,
    `Tone: ${persona.tone}`,
    `Style: ${persona.style}`,
    "Use dramatic pacing, clear pauses between paragraphs, controlled tension, and a storybook cadence.",
    "Do not sound like a menu, announcer, or chatbot. Perform the page like narration from a fantasy audiobook."
  ].join(" ");
}

async function synthesizeStoryVoice({ text, personaKey = "ADMIN", voiceMode = "female" }) {
  const input = String(text || "").trim().slice(0, 4096);
  if (!input) {
    throw new Error("Voice text is required.");
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "#") {
    throw new Error("OPENAI_API_KEY is required for AI voice narration.");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: voiceByMode[voiceMode] || voiceByMode.female,
      input,
      instructions: toneInstructions(personaKey, voiceMode),
      response_format: "mp3"
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || "OpenAI voice request failed.");
  }

  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  synthesizeStoryVoice
};
