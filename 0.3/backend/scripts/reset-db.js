const oldTables = [
  "combat_status_effects",
  "player_boss_progress",
  "story_bosses",
  "dungeon_floors",
  "dungeons",
  "player_characters",
  "player_skills",
  "player_inventory",
  "story_messages",
  "story_memories",
  "deep_saga_players"
];

const newTables = [
  "deep_saga_story_events",
  "deep_saga_story_messages",
  "deep_saga_world_state",
  "deep_saga_open_threads",
  "deep_saga_story_memories",
  "deep_saga_canonical_facts",
  "deep_saga_discoveries",
  "deep_saga_relationships",
  "deep_saga_npcs",
  "deep_saga_resources",
  "deep_saga_abilities",
  "deep_saga_traits",
  "deep_saga_action_requests",
  "deep_saga_character_states",
  "deep_saga_runs",
  "deep_saga_chapters",
  "deep_saga_story_guides",
  "deep_saga_books"
];

function assertDevelopmentResetAllowed() {
  const env = String(process.env.NODE_ENV || "development").toLowerCase();
  const strongOverride = process.env.DEEP_SAGA_ALLOW_DESTRUCTIVE_RESET === "I_UNDERSTAND_THIS_DROPS_DEEP_SAGA_0_3_DATA";

  if (env === "production" && !strongOverride) {
    throw new Error("Refusing destructive reset in production. Set the explicit development-only override only for non-production recovery.");
  }
}

async function dropTables(tables) {
  const db = require("../db");

  for (const table of tables) {
    await db.query(`DROP TABLE IF EXISTS ${table}`);
  }
}

async function reset() {
  const { migrate } = require("./migrate");

  assertDevelopmentResetAllowed();
  await dropTables([...oldTables, ...newTables]);
  await migrate();
  console.log("Deep Saga 0.3 development database reset complete.");
}

if (require.main === module) {
  reset().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  assertDevelopmentResetAllowed,
  reset
};
