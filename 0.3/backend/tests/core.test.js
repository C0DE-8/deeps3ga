const test = require("node:test");
const assert = require("node:assert/strict");

const { startingState, getBlockedRevelations } = require("../books/ant-world/story-guide");
const { validateGameMasterOutput, inferCategory } = require("../services/game-master.service");
const { boundedExperience, categoryDevelopment, validateAbility, validateCharacterStateChanges, validateChapterProgress } = require("../services/turn-engine.service");
const { assertDevelopmentResetAllowed } = require("../scripts/reset-db");

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
    suggestedChoices: ["Stay still"],
    proposedResources: [{ name: "Dew bead", quantity: 1 }],
    storyEvents: [{ eventType: "FIRST_SCENT_MEMORY", title: "First Scent Memory" }]
  });
  assert.equal(output.suggestedChoices[0].label, "Stay still");
  assert.equal(output.proposedResources.length, 1);
  assert.equal(output.storyEvents.length, 1);
  assert.equal(output.death.occurred, false);
});

test("experience awards are bounded", () => {
  assert.equal(boundedExperience({ proposedExperience: [{ amount: 500 }, { amount: 20 }] }), 35);
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
