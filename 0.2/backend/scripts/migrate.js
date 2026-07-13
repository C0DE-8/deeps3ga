const { ensurePlayerSchema } = require("../services/player.service");

async function run() {
  await ensurePlayerSchema();
  console.log("Deep Saga backend schema is up to date.");
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
