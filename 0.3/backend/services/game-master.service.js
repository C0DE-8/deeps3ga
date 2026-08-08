const { keyFromName } = require("./json");

const allowedTopLevelKeys = [
  "narration",
  "suggestedChoices",
  "sceneAssessment",
  "proposedStateChanges",
  "proposedExperience",
  "proposedManaChanges",
  "proposedHealthChanges",
  "proposedTraits",
  "proposedAbilities",
  "proposedResources",
  "relationshipChanges",
  "newDiscoveries",
  "canonicalFacts",
  "memoryCandidates",
  "openThreadUpdates",
  "worldStateChanges",
  "storyEvents",
  "chapterProgress",
  "sceneProgress",
  "death",
  "endingCandidate"
];

function emptyProposal() {
  return {
    narration: "",
    suggestedChoices: [],
    sceneAssessment: { tone: "uncertain", threat: "low", actionCategory: "observe" },
    proposedStateChanges: {},
    proposedExperience: [],
    proposedManaChanges: [],
    proposedHealthChanges: [],
    proposedTraits: [],
    proposedAbilities: [],
    proposedResources: [],
    relationshipChanges: [],
    newDiscoveries: [],
    canonicalFacts: [],
    memoryCandidates: [],
    openThreadUpdates: [],
    worldStateChanges: [],
    storyEvents: [],
    chapterProgress: { chapterComplete: false, targetChapter: null, reason: "" },
    sceneProgress: { nextScene: null, nextBeat: null, reason: "" },
    death: { occurred: false, reason: "", location: "" },
    endingCandidate: null
  };
}

function sanitizeChoice(choice) {
  if (typeof choice === "string") return { label: choice.slice(0, 80), action: choice.slice(0, 500) };
  return {
    label: String(choice?.label || choice?.text || "Act").slice(0, 80),
    action: String(choice?.action || choice?.text || choice?.label || "").slice(0, 500)
  };
}

function validateGameMasterOutput(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Game Master output must be an object.");
  }

  for (const key of Object.keys(raw)) {
    if (!allowedTopLevelKeys.includes(key)) {
      throw new Error(`Game Master output included unsupported field: ${key}`);
    }
  }

  const proposal = { ...emptyProposal(), ...raw };

  if (typeof proposal.narration !== "string" || proposal.narration.trim().length < 20) {
    throw new Error("Game Master narration is missing or too short.");
  }

  proposal.narration = proposal.narration.trim();
  proposal.suggestedChoices = Array.isArray(proposal.suggestedChoices) ? proposal.suggestedChoices.slice(0, 4).map(sanitizeChoice) : [];
  proposal.proposedExperience = Array.isArray(proposal.proposedExperience) ? proposal.proposedExperience : [];
  proposal.proposedManaChanges = Array.isArray(proposal.proposedManaChanges) ? proposal.proposedManaChanges : [];
  proposal.proposedHealthChanges = Array.isArray(proposal.proposedHealthChanges) ? proposal.proposedHealthChanges : [];
  proposal.proposedTraits = Array.isArray(proposal.proposedTraits) ? proposal.proposedTraits : [];
  proposal.proposedAbilities = Array.isArray(proposal.proposedAbilities) ? proposal.proposedAbilities : [];
  proposal.proposedResources = Array.isArray(proposal.proposedResources) ? proposal.proposedResources : [];
  proposal.relationshipChanges = Array.isArray(proposal.relationshipChanges) ? proposal.relationshipChanges : [];
  proposal.newDiscoveries = Array.isArray(proposal.newDiscoveries) ? proposal.newDiscoveries : [];
  proposal.canonicalFacts = Array.isArray(proposal.canonicalFacts) ? proposal.canonicalFacts : [];
  proposal.memoryCandidates = Array.isArray(proposal.memoryCandidates) ? proposal.memoryCandidates : [];
  proposal.openThreadUpdates = Array.isArray(proposal.openThreadUpdates) ? proposal.openThreadUpdates : [];
  proposal.worldStateChanges = Array.isArray(proposal.worldStateChanges) ? proposal.worldStateChanges : [];
  proposal.storyEvents = Array.isArray(proposal.storyEvents) ? proposal.storyEvents : [];
  proposal.death = { ...emptyProposal().death, ...(proposal.death || {}) };
  proposal.chapterProgress = { ...emptyProposal().chapterProgress, ...(proposal.chapterProgress || {}) };
  proposal.sceneProgress = { ...emptyProposal().sceneProgress, ...(proposal.sceneProgress || {}) };

  return proposal;
}

function inferCategory(action) {
  const text = String(action || "").toLowerCase();
  if (/(attack|bite|fight|strike|kill|ambush)/.test(text)) return "combat";
  if (/(hide|flee|survive|still|protect myself)/.test(text)) return "survival";
  if (/(observe|study|understand|analyze|watch|listen|scent)/.test(text)) return "analysis";
  if (/(mana|magic|soul|energy|resonance)/.test(text)) return "magic";
  if (/(help|protect|comfort|share|support)/.test(text)) return "support";
  if (/(lead|command|signal|organize|coordinate)/.test(text)) return "leadership";
  if (/(crawl|search|explore|tunnel|sound)/.test(text)) return "scouting";
  return "observe";
}

function localGameMaster(context) {
  const action = String(context.playerAction || "").trim();
  const category = inferCategory(action);
  const location = context.playerState.location;
  const chapter = context.currentChapter?.chapterNumber || 1;

  const sensory = category === "combat"
    ? "Your soft body strains toward violence, but the nursery reminds you of the truth: intent is not strength. You can twitch, bite at what comes close, and make noise through scent, not perform miracles."
    : category === "analysis"
      ? "You go still inside the warm dark and let the scents arrange themselves. Hunger is sharp. Brood is round and constant. Alarm is a bitter thread too faint for the workers to fully notice."
      : category === "magic"
        ? "Something inside you answers the thought with a pressure too deep to name. You do not understand mana yet, but the sensation leaves a pale ache behind your new instincts."
        : "The nursery shifts around you in pulses of scent and touch. Workers pass like living walls, their attention practical and vast, while your human panic beats inside a body built for helplessness.";

  const narration = [
    `You attempt: ${action || "to understand where you are"}.`,
    sensory,
    "A worker pauses over you. Her antennae brush your slick side, and a translated impression reaches you through pheromone rather than speech: alive, strange, watch. The word strange is not spoken, but it clings to you.",
    chapter === 1 ? "Far below the normal nursery scent, something bitter moves through the tunnel air and vanishes before you can decide whether it was real." : "The consequence settles into the living world around you."
  ].join("\n\n");

  const proposal = emptyProposal();
  proposal.narration = narration;
  proposal.suggestedChoices = [
    { label: "Observe the bitter scent", action: "I stay still and focus on the bitter scent before it disappears." },
    { label: "Signal the worker", action: "I try to send a simple pheromone signal: danger, here." },
    { label: "Protect myself", action: "I curl inward and hide among the other larvae." }
  ];
  proposal.sceneAssessment = { tone: "intimate dread", threat: "low", actionCategory: category };
  proposal.proposedExperience = [{ category, amount: 8, reason: `The player attempted ${category} from a larval body and learned its limits.` }];
  proposal.memoryCandidates = [{ content: `In ${location}, the player attempted to ${action || "make sense of rebirth"} and noticed a bitter disturbance.`, importance: 5, tags: ["chapter-1", category, location] }];
  proposal.sceneProgress = { nextScene: category === "analysis" || category === "magic" ? "nursery" : null, nextBeat: category === "analysis" ? "pheromone_perception" : null, reason: "Small scene movement from the opening awakening." };
  return validateGameMasterOutput(proposal);
}

async function callOpenAiGameMaster(context) {
  if (!process.env.OPENAI_API_KEY) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "You are the Deep Saga Game Master. Return only valid JSON matching the requested schema. The player action is intent, not reality. Do not reveal blocked future spoilers."
        },
        {
          role: "user",
          content: JSON.stringify(context)
        }
      ],
      text: { format: { type: "json_object" } }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "OpenAI Game Master request failed.");
  const text = payload.output_text || payload.output?.flatMap((item) => item.content || []).find((part) => part.text)?.text;
  if (!text) throw new Error("OpenAI Game Master returned no JSON text.");
  return validateGameMasterOutput(JSON.parse(text));
}

async function createGameMasterProposal(context) {
  try {
    const remote = await callOpenAiGameMaster(context);
    if (remote) return remote;
  } catch (firstError) {
    try {
      const remote = await callOpenAiGameMaster({
        ...context,
        repairInstruction: `Previous Game Master output failed validation: ${firstError.message}. Return a corrected JSON object only.`
      });
      if (remote) return remote;
    } catch (secondError) {
      console.warn("Remote Game Master failed; using local fallback.", {
        firstError: firstError.message,
        secondError: secondError.message
      });
    }
  }
  return localGameMaster(context);
}

module.exports = {
  createGameMasterProposal,
  emptyProposal,
  inferCategory,
  keyFromName,
  validateGameMasterOutput
};
