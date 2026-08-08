const fs = require("fs");
const path = require("path");

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applyMigration(filePath) {
  const db = require("../db");
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = splitSql(sql);

  for (const statement of statements) {
    await db.query(statement);
  }
}

async function migrate() {
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    await applyMigration(path.join(migrationsDir, file));
    console.log(`Applied ${file}`);
  }
}

if (require.main === module) {
  migrate()
    .then(() => console.log("Deep Saga 0.3 schema is up to date."))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  migrate,
  splitSql
};
