const test = require("node:test");
const assert = require("node:assert/strict");

const { startingState, getBlockedRevelations } = require("../books/ant-world/story-guide");
const { createGameMasterProposal, validateGameMasterOutput, inferCategory } = require("../services/game-master.service");
const { assessActionPossibility, classifications, isGuidedChoicePossible, resolveCapabilities, selectGuidedChoice } = require("../services/capability.service");
const { boundedExperience, categoryDevelopment, validateAbility, validateCharacterStateChanges, validateChapterProgress } = require("../services/turn-engine.service");
const { assertDevelopmentResetAllowed } = require("../scripts/reset-db");
const { createToken, verifyToken } = require("../utils/token");

test("Ant World canonical starting state is an ant larva with human memories", () => {
  assert.equal(startingState.character.species, "Ant");
  assert.equal(startingState.character.lifeStage, "Larva");
  assert.equal(startingState.character.level, 1);
  assert.equal(startingState.character.humanMemoriesRetained, true);
  assert.equal(startingState.character.location, "Ant Nursery");
});

test("Chapter 1 blocks future spoiler categories", () => {
  const blocked = getBlockedRevelations(1);
  assert.ok(blocked.includes("full Ant King revelation"));
  assert.ok(blocked.includes("tournament soul-energy revelation"));
  assert.ok(blocked.includes("sanctuary truth"));
  assert.ok(blocked.includes("final enemy"));
  assert.ok(blocked.includes("final evolution logic"));
});

test("structured narrator validation rejects malformed or unsafe fields", () => {
  assert.throws(() => validateGameMasterOutput({ narration: "short" }), /too short/);
  assert.throws(() => validateGameMasterOutput({ narration: "This is long enough to parse safely.", sql: "DROP TABLE users" }), /unsupported/);
});

test("structured narrator validation normalizes optional choices", () => {
  const output = validateGameMasterOutput({
    narration: "The nursery breathes around you while scent becomes almost-language.",
    suggestedChoices: ["Stay still", "Run into the tunnel"],
    proposedResources: [{ name: "Dew bead", quantity: 1 }],
    storyEvents: [{ eventType: "FIRST_SCENT_MEMORY", title: "First Scent Memory" }]
  });
  assert.equal(output.suggestedChoices[0].label, "Stay still");
  assert.equal(output.suggestedChoices.length, 1);
  assert.equal(output.proposedResources.length, 1);
  assert.equal(output.storyEvents.length, 1);
  assert.equal(output.death.occurred, false);
});

test("structured narrator validation accepts common narration aliases", () => {
  const output = validateGameMasterOutput({
    playerResponse: "You remain still, and the scent language of the nursery presses against your new instincts."
  });
  assert.match(output.narration, /remain still/);
});

test("experience awards are bounded", () => {
  assert.equal(boundedExperience({ proposedExperience: [{ amount: 500 }, { amount: 20 }] }), 35);
});

test("capability model derives larval limits from current state", () => {
  const capabilities = resolveCapabilities({
    book: { slug: "ant-world" },
    run: { currentChapter: 1 },
    character: startingState.character
  });
  assert.ok(capabilities.can.includes("pheromone_perception"));
  assert.ok(capabilities.cannot.includes("run"));
  assert.ok(capabilities.cannot.includes("known_spellcasting"));
});

test("larva cannot run, fly, or cast unknown magic by typing it", () => {
  const state = { run: { currentChapter: 1 }, character: startingState.character, abilities: [], discoveries: [], facts: [] };
  assert.equal(assessActionPossibility({ ...state, action: "I run into the tunnel." }).classification, classifications.impossible);
  assert.equal(assessActionPossibility({ ...state, action: "I fly above the colony." }).classification, classifications.impossible);
  assert.equal(assessActionPossibility({ ...state, action: "I cast Fire Lance." }).classification, classifications.impossible);
  assert.equal(assessActionPossibility({ ...state, action: "I pray I grow asap." }).classification, classifications.impossible);
});

test("unknown story knowledge is not created by player text", () => {
  const state = { run: { currentChapter: 1 }, character: startingState.character, abilities: [], discoveries: startingState.discoveries, facts: [] };
  const assessment = assessActionPossibility({ ...state, action: "I ask the Queen about the Ant King." });
  assert.equal(assessment.classification, classifications.unknown);
  assert.equal(assessment.allowedAttempt, false);
});

test("guided choice filter accepts possible larval actions and rejects impossible ones", () => {
  const state = { run: { currentChapter: 1 }, character: startingState.character, abilities: [], discoveries: startingState.discoveries, facts: [] };
  assert.equal(isGuidedChoicePossible({ label: "Focus", action: "I focus on the pheromone scents around me." }, state), true);
  assert.equal(isGuidedChoicePossible({ label: "Fly", action: "I fly above the colony." }, state), false);
  assert.match(selectGuidedChoice(state).action, /pheromone|body|observe|memories/i);
});

test("behavior signals map to hidden development columns", () => {
  assert.equal(inferCategory("I observe the workers and analyze the scent"), "analysis");
  assert.equal(categoryDevelopment("analysis"), "analysis_development");
  assert.equal(categoryDevelopment("combat"), "combat_development");
});

test("illegal chapter skipping is rejected", () => {
  assert.throws(
    () => validateChapterProgress({ currentChapter: 1 }, { chapterProgress: { chapterComplete: true, targetChapter: 9 } }),
    /one at a time/
  );
});

test("valid chapter progression advances one chapter", () => {
  assert.deepEqual(
    validateChapterProgress({ currentChapter: 1 }, { chapterProgress: { chapterComplete: true, targetChapter: 2 } }),
    { advance: true, targetChapter: 2 }
  );
});

test("powerful abilities require earned state", () => {
  assert.throws(
    () => validateAbility({ name: "Royal Cataclysm", reason: "earned by asking", powerTier: 5 }, { level: 1 }),
    /too high/
  );
});

test("early evolution state changes are rejected", () => {
  assert.throws(
    () => validateCharacterStateChanges(
      { character: { lifeStage: "Royal Ant", evolutionReason: "The narrator thought it sounded dramatic." } },
      { lifeStage: "Larva", level: 1, evolutionState: {} },
      { currentChapter: 1 }
    ),
    /evolution requires/
  );
});

test("allowed character state changes are converted to SQL assignments", () => {
  const result = validateCharacterStateChanges(
    { character: { conditionText: "Alert and hungry.", location: "Nursery edge", manaKnown: true } },
    { lifeStage: "Larva", level: 1, evolutionState: {} },
    { currentChapter: 1 }
  );
  assert.ok(result.assignments.includes("condition_text = ?"));
  assert.ok(result.assignments.includes("location = ?"));
  assert.ok(result.assignments.includes("mana_known = 1"));
});

test("auth tokens use the 0.3 user identity shape", () => {
  const previousSecret = process.env.AUTH_TOKEN_SECRET;
  process.env.AUTH_TOKEN_SECRET = "test-secret";
  const token = createToken({ userId: 42, email: "ant@example.com" });
  const payload = verifyToken(token);
  assert.equal(payload.sub, 42);
  assert.equal(payload.email, "ant@example.com");
  if (previousSecret == null) delete process.env.AUTH_TOKEN_SECRET;
  else process.env.AUTH_TOKEN_SECRET = previousSecret;
});

test("remote Game Master failures fall back to local narration", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = global.fetch;
  const previousWarn = console.warn;

  process.env.OPENAI_API_KEY = "test-key";
  global.fetch = async () => {
    throw new Error("simulated model outage");
  };
  console.warn = () => {};

  const proposal = await createGameMasterProposal({
    playerAction: "I stay still and observe.",
    playerState: { location: "Ant Nursery" },
    currentChapter: { chapterNumber: 1 }
  });

  assert.match(proposal.narration, /You attempt/);
  assert.equal(proposal.death.occurred, false);

  if (previousKey == null) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  global.fetch = previousFetch;
  console.warn = previousWarn;
});

test("local Game Master turns impossible wishes into story flow", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const assessment = assessActionPossibility({
    action: "I pray I grow wings and fly away.",
    run: { currentChapter: 1 },
    character: startingState.character,
    abilities: [],
    discoveries: startingState.discoveries,
    facts: []
  });
  const proposal = await createGameMasterProposal({
    playerAction: "I pray I grow wings and fly away.",
    playerState: startingState.character,
    currentChapter: { chapterNumber: 1 },
    actionAssessment: assessment,
    guidedChoice: { label: "Focus on the scents", action: "I focus on the pheromone scents around me." }
  });
  assert.match(proposal.narration, /wish|noticed|Nothing dramatic happens/i);
  assert.equal(proposal.suggestedChoices.length, 1);
  if (previousKey == null) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

test("production reset protection refuses without strong override", () => {
  const previousEnv = process.env.NODE_ENV;
  const previousOverride = process.env.DEEP_SAGA_ALLOW_DESTRUCTIVE_RESET;
  process.env.NODE_ENV = "production";
  delete process.env.DEEP_SAGA_ALLOW_DESTRUCTIVE_RESET;
  assert.throws(() => assertDevelopmentResetAllowed(), /Refusing/);
  process.env.NODE_ENV = previousEnv;
  if (previousOverride == null) delete process.env.DEEP_SAGA_ALLOW_DESTRUCTIVE_RESET;
  else process.env.DEEP_SAGA_ALLOW_DESTRUCTIVE_RESET = previousOverride;
});
