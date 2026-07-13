const crypto = require("crypto");
const db = require("../db");
const { hashPassword, verifyPassword } = require("../utils/password");

const monsterRaces = [
  {
    race: "Slime",
    strengths: ["adaptive body", "acidic touch", "silent movement"],
    weaknesses: ["low physical force", "vulnerable to heat"],
    skills: ["Absorb", "Split Form", "Acid Drop"],
    evolutionPaths: ["Gel Core", "Venom Slime", "Mimic Ooze"]
  },
  {
    race: "Spider",
    strengths: ["web control", "wall crawling", "ambush instincts"],
    weaknesses: ["fragile frame", "weak against fire"],
    skills: ["Silk Trap", "Venom Bite", "Ceiling Stalk"],
    evolutionPaths: ["Cave Weaver", "Arachne Spawn", "Night Widow"]
  },
  {
    race: "Goblin",
    strengths: ["tool use", "dirty tactics", "fast learning"],
    weaknesses: ["small body", "feared by settlements"],
    skills: ["Scavenge", "Cheap Shot", "Pack Signal"],
    evolutionPaths: ["Hobgoblin", "Goblin Shaman", "Goblin Assassin"]
  },
  {
    race: "Kobold",
    strengths: ["trap sense", "ore scent", "group tactics"],
    weaknesses: ["poor daylight vision", "low stamina"],
    skills: ["Tunnel Step", "Snare Craft", "Ore Nose"],
    evolutionPaths: ["Drake Kobold", "Kobold Smith", "Scale Scout"]
  },
  {
    race: "Wolf",
    strengths: ["speed", "scent tracking", "pack pressure"],
    weaknesses: ["limited hands", "vulnerable alone"],
    skills: ["Blood Scent", "Pounce", "Howl"],
    evolutionPaths: ["Dire Wolf", "Moon Fang", "Fenrir Pup"]
  },
  {
    race: "Skeleton",
    strengths: ["no pain", "dark vision", "necrotic resistance"],
    weaknesses: ["holy magic", "blunt weapons"],
    skills: ["Bone Guard", "Deathless Step", "Grave Chill"],
    evolutionPaths: ["Bone Knight", "Wraith Husk", "Lich Seed"]
  },
  {
    race: "Bat",
    strengths: ["flight", "echolocation", "escape routes"],
    weaknesses: ["weak defense", "bright light"],
    skills: ["Echo Pulse", "Dive Bite", "Wing Feint"],
    evolutionPaths: ["Vampire Bat", "Cave Screecher", "Night Imp"]
  },
  {
    race: "Mimic Larva",
    strengths: ["disguise", "patience", "surprise attacks"],
    weaknesses: ["slow movement", "limited speech"],
    skills: ["False Shape", "Clamp", "Treasure Scent"],
    evolutionPaths: ["Chest Mimic", "Weapon Mimic", "House Mimic"]
  }
];

let schemaReady = null;

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function randomMonsterBody() {
  const template = monsterRaces[crypto.randomInt(monsterRaces.length)];

  return {
    ...template,
    level: 1,
    dungeon: 1,
    floor: 1,
    status: "newly reincarnated",
    origin: "first death in the real world"
  };
}

function serializePlayer(row) {
  return {
    playerId: row.player_id,
    email: row.email,
    currentRun: Number(row.current_run || 1),
    cycleClears: Number(row.cycle_clears || 0),
    currentBody: parseJson(row.current_body, null),
    memoryLog: parseJson(row.memory_log, []),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

function createPlayerId() {
  return `DS-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

async function ensurePlayerSchema() {
  if (schemaReady) {
    return schemaReady;
  }

  schemaReady = db.execute(`
    CREATE TABLE IF NOT EXISTS deep_saga_players (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(32) NOT NULL UNIQUE,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(180) NOT NULL,
      current_run INT NOT NULL DEFAULT 1,
      cycle_clears INT NOT NULL DEFAULT 0,
      current_body JSON NULL,
      memory_log JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP NULL,
      INDEX idx_deep_saga_players_email (email),
      INDEX idx_deep_saga_players_player_id (player_id)
    )
  `);

  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }

  return schemaReady;
}

async function findPlayerByIdentifier(identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const rows = await db.query(
    "SELECT player_id, email, password_hash, current_run, cycle_clears, current_body, memory_log, created_at, last_login_at FROM deep_saga_players WHERE LOWER(email) = ? OR LOWER(player_id) = ? LIMIT 1",
    [normalized, normalized]
  );

  return rows[0] || null;
}

async function registerPlayer({ email, password }) {
  await ensurePlayerSchema();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const body = randomMonsterBody();
  const memories = [
    "You remember fluorescent lights, a final human breath, and the impossible feeling of waking inside a dungeon body."
  ];
  const passwordHash = await hashPassword(password);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const playerId = createPlayerId();

    try {
      await db.execute(
        "INSERT INTO deep_saga_players (player_id, email, password_hash, current_body, memory_log) VALUES (?, ?, ?, ?, ?)",
        [playerId, normalizedEmail, passwordHash, JSON.stringify(body), JSON.stringify(memories)]
      );

      const player = await findPlayerByIdentifier(playerId);
      return serializePlayer(player);
    } catch (error) {
      const message = String(error.message || "");

      if (message.includes("Duplicate") && attempt < 4) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to allocate a unique Player ID.");
}

async function loginPlayer({ identifier, password }) {
  await ensurePlayerSchema();

  const player = await findPlayerByIdentifier(identifier);
  const valid = player ? await verifyPassword(password, player.password_hash) : false;

  if (!player || !valid) {
    return null;
  }

  await db.execute("UPDATE deep_saga_players SET last_login_at = CURRENT_TIMESTAMP WHERE player_id = ?", [player.player_id]);

  return serializePlayer(player);
}

module.exports = {
  ensurePlayerSchema,
  loginPlayer,
  monsterRaces,
  randomMonsterBody,
  registerPlayer,
  serializePlayer
};
