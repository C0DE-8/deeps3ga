const { keyFromName } = require("./json");

const classifications = {
  possible: "POSSIBLE_NOW",
  attempt: "POSSIBLE_TO_ATTEMPT",
  partial: "PARTIAL_SUCCESS",
  impossible: "IMPOSSIBLE_NOW",
  unknown: "UNKNOWN_TO_PLAYER",
  worldImpossible: "IMPOSSIBLE_IN_THIS_WORLD",
  npcControl: "NPC_CONTROL_ATTEMPT",
  outcomeAssertion: "OUTCOME_ASSERTION"
};

function textIncludes(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function knowledgeKeys(discoveries = [], facts = []) {
  return new Set([
    ...discoveries.map((item) => item.key || item.discoveryKey || keyFromName(item.title)),
    ...facts.map((item) => item.key || item.factKey || keyFromName(item.content))
  ]);
}

function abilityKeys(abilities = []) {
  return new Set(abilities.map((ability) => ability.key || ability.abilityKey || keyFromName(ability.name)));
}

function resolveCapabilities({ book, character, abilities = [], traits = [], resources = [], discoveries = [], facts = [], run = {} }) {
  const species = String(character?.species || "").toLowerCase();
  const lifeStage = String(character?.lifeStage || "").toLowerCase();
  const isAntLarva = species === "ant" && lifeStage === "larva";
  const learnedAbilities = abilityKeys(abilities);
  const known = knowledgeKeys(discoveries, facts);
  const manaKnown = Boolean(character?.manaKnown);

  const capability = {
    bookSlug: book?.slug || "ant-world",
    chapter: Number(run.currentChapter || 1),
    species: character?.species || "Ant",
    lifeStage: character?.lifeStage || "Larva",
    location: character?.location || "Unknown",
    manaKnown,
    learnedAbilityKeys: [...learnedAbilities],
    knownFactKeys: [...known],
    can: [
      "think",
      "remember_personal_past",
      "observe_nearby_stimuli",
      "wait",
      "hesitate",
      "refuse"
    ],
    limited: [],
    cannot: [
      "declare_success",
      "create_items_from_text",
      "create_npcs_from_text",
      "control_npcs_from_text",
      "create_world_facts_from_text",
      "use_unknown_knowledge",
      "use_unlearned_abilities"
    ],
    possibleGuidedChoices: []
  };

  if (isAntLarva) {
    capability.can.push("pheromone_perception", "limited_body_movement", "eat_when_fed", "instinctive_reaction", "limited_communication_attempt");
    capability.limited.push("crawl_or_twist_only_short_distances", "bite_only_if_contact_is_possible", "communication_is_instinctive_not_speech");
    capability.cannot.push("run", "walk_normally", "fly", "wield_weapons", "command_workers", "adult_ant_combat", "known_spellcasting");
    capability.possibleGuidedChoices = [
      { label: "Focus on the scents", action: "I focus on the pheromone scents around me." },
      { label: "Understand this body", action: "I try to understand my new larval body." },
      { label: "Observe the worker", action: "I quietly observe the worker tending the nursery." },
      { label: "Search my memories", action: "I search my human memories for what happened before I woke here." }
    ];
  }

  if (manaKnown || learnedAbilities.size > 0) {
    capability.can.push("sense_known_mana_effects");
  }

  for (const ability of abilities) {
    capability.can.push(`ability:${ability.key || keyFromName(ability.name)}`);
  }

  for (const trait of traits) {
    capability.can.push(`trait:${trait.key || keyFromName(trait.name)}`);
  }

  for (const resource of resources) {
    capability.can.push(`resource:${resource.key || keyFromName(resource.name)}`);
  }

  return capability;
}

function normalizeIntent(action) {
  const raw = String(action || "").trim();
  let normalized = raw;
  normalized = normalized.replace(/\bi successfully\b/gi, "I attempt to");
  normalized = normalized.replace(/\bi kill\b/gi, "I attempt to kill");
  normalized = normalized.replace(/\bi convince\b/gi, "I attempt to convince");
  normalized = normalized.replace(/\bi steal\b/gi, "I attempt to steal");
  normalized = normalized.replace(/\bi make (the|an?)\b/gi, "I try to make $1");
  normalized = normalized.replace(/\b(the queen|queen|enemy|worker|guard) (trusts|tells|runs|flees|joins|obeys)\b/gi, "I try to influence $1 to $2");
  return { raw, normalized };
}

function assessActionPossibility({ action, run, character, abilities = [], discoveries = [], facts = [] }) {
  const intent = normalizeIntent(action);
  const text = intent.raw.toLowerCase();
  const capabilities = resolveCapabilities({ run, character, abilities, discoveries, facts });
  const learnedAbilities = new Set(capabilities.learnedAbilityKeys);
  const known = new Set(capabilities.knownFactKeys);
  const blocks = [];
  const warnings = [];
  let classification = classifications.possible;
  let allowedAttempt = true;
  let boundedOutcome = "The protagonist may attempt the intent, but the engine decides what becomes real.";

  if (textIncludes(text, [/smart\s*phone|smartphone|internet|gun|car|superman|lightsaber|earth|real world|computer/])) {
    blocks.push("The action imports items, places, or fiction outside established Eldara canon.");
    classification = classifications.worldImpossible;
    allowedAttempt = false;
  }

  if (textIncludes(text, [/royal soul resonance|ant king|king's sanctuary|kings sanctuary|grand insect tournament|great war/])) {
    const knowsRelevantTruth = known.has("royal-soul-resonance") || known.has("ant-king") || known.has("tournament-truth") || known.has("sanctuary-location-known");
    if (!knowsRelevantTruth && Number(run?.currentChapter || 1) < 2) {
      blocks.push("The protagonist has not discovered this knowledge.");
      classification = classifications.unknown;
      allowedAttempt = false;
    }
  }

  if (textIncludes(text, [/cast|spell|fire lance|fireball|magic|teleport|summon/])) {
    const hasMagic = character?.manaKnown || learnedAbilities.size > 0;
    if (!hasMagic) {
      blocks.push("No learned magic or known spell supports this action.");
      classification = classifications.impossible;
      allowedAttempt = false;
    }
  }

  if (textIncludes(text, [/\bgrow\b|\bevolve\b|\btransform\b|\bbecome adult\b|\basap\b|\binstantly\b/])) {
    blocks.push("Growth and evolution require earned biological and story conditions.");
    classification = classifications.impossible;
    allowedAttempt = false;
  }

  if (String(character?.lifeStage || "").toLowerCase() === "larva") {
    if (textIncludes(text, [/\brun\b|\bwalk\b|\bstand\b|\bfly\b|\bwings?\b/])) {
      blocks.push("The current larval body cannot run, walk normally, stand, or fly.");
      classification = classifications.impossible;
      allowedAttempt = false;
    }
    if (textIncludes(text, [/\bcommand\b|\border\b|\blead\b.*workers?|\bspeak\b/])) {
      blocks.push("The larva has no authority or developed communication sufficient to command others.");
      classification = classifications.impossible;
      allowedAttempt = false;
    }
  }

  if (textIncludes(text, [/the queen (trusts|tells|obeys|joins)|enemy (runs|flees|dies)|worker (obeys|carries|believes)|my best friend .* walks in|bob .* walks in/])) {
    blocks.push("The player cannot directly author NPC behavior, relationships, or new NPC facts.");
    classification = classifications.npcControl;
    allowedAttempt = false;
  }

  if (textIncludes(text, [/\bi .* kill\b|\bi .* successfully\b|\bi .* convince\b|\bi .* steal\b|\bi .* win\b/])) {
    warnings.push("Outcome language is interpreted as intent only, not success.");
    if (allowedAttempt) classification = classifications.outcomeAssertion;
  }

  if (!allowedAttempt) {
    boundedOutcome = "The Game Master should narrate a natural failed or impossible attempt without granting movement, knowledge, powers, items, relationships, NPC actions, or world facts.";
  } else if (warnings.length > 0) {
    boundedOutcome = "The action can be attempted, but asserted success is stripped from the intent.";
  } else if (String(character?.lifeStage || "").toLowerCase() === "larva" && textIncludes(text, [/crawl|move|twist|drag|bite|attack/])) {
    classification = classifications.partial;
    boundedOutcome = "The action is limited by the larval body and should resolve as partial or costly unless contact is already possible.";
  }

  return {
    classification,
    allowedAttempt,
    rawAction: intent.raw,
    normalizedIntent: intent.normalized,
    blocks,
    warnings,
    boundedOutcome,
    capabilities
  };
}

function isGuidedChoicePossible(choice, state) {
  const text = typeof choice === "string" ? choice : choice?.action || choice?.label || "";
  const assessment = assessActionPossibility({ action: text, ...state });
  return assessment.allowedAttempt && assessment.classification !== classifications.worldImpossible && assessment.classification !== classifications.unknown;
}

function selectGuidedChoice(state) {
  const capabilities = resolveCapabilities(state);
  return capabilities.possibleGuidedChoices.find((choice) => isGuidedChoicePossible(choice, state)) || {
    label: "Observe quietly",
    action: "I stay still and observe what is happening nearby."
  };
}

module.exports = {
  assessActionPossibility,
  classifications,
  isGuidedChoicePossible,
  normalizeIntent,
  resolveCapabilities,
  selectGuidedChoice
};
