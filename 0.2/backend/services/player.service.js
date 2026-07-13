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
const allowedPersonas = new Set(["ADMIN", "TRICKSTER", "SENSEI"]);
const narratorPersonas = [
  {
    key: "ADMIN",
    role: "The Divine Administrator",
    tone: "Cold, analytical, clinical, absolute.",
    style: "Short, exact, efficient. Focus on survival cost, anomalies, and consequences.",
    loreFormat: "system bulletin, classified update, or world-state report",
    choiceBias: "efficient, tactical, low-emotion",
    hintStyle: "direct survival hints",
    failureStyle: "clinical diagnosis of the failed attempt",
    description: "Cold, analytical, survival-focused narration."
  },
  {
    key: "TRICKSTER",
    role: "The Chaotic Observer",
    tone: "Playful, mocking, dangerous, amused.",
    style: "Teasing, dramatic, enjoys tension and irony.",
    loreFormat: "forbidden gossip, accidental spoiler, or whispered rumor",
    choiceBias: "risky, clever, emotionally provocative",
    hintStyle: "crooked hints, half-truths, bait",
    failureStyle: "mockery, laughter, cruel delight",
    description: "Playful, mocking, dangerous narration with crooked hints."
  },
  {
    key: "SENSEI",
    role: "The Iron Mentor",
    tone: "Stern, seasoned, demanding, martial.",
    style: "Blunt battlefield language with survival lessons.",
    loreFormat: "combat brief, veteran warning, or tactical field note",
    choiceBias: "disciplined, survival-first, combat-ready",
    hintStyle: "hard lessons and practical guidance",
    failureStyle: "scolding, correction, emphasis on discipline",
    description: "Stern, tactical narration with battlefield lessons."
  }
];

const skillCatalog = [
  { key: "absorb", name: "Absorb", family: "Predator", type: "Soul", description: "Consume weakened matter to recover and learn from what remains.", rarity: "common" },
  { key: "split_form", name: "Split Form", family: "Predator", type: "Body", description: "Divide part of the body to escape, scout, or confuse a threat.", rarity: "uncommon" },
  { key: "acid_drop", name: "Acid Drop", family: "Predator", type: "Corrosion", description: "Release acidic fluid that eats through weak flesh, bindings, or soft armor.", rarity: "common" },
  { key: "silk_trap", name: "Silk Trap", family: "Shadow", type: "Control", description: "Lay hidden strands that catch movement and expose careless enemies.", rarity: "common" },
  { key: "venom_bite", name: "Venom Bite", family: "Predator", type: "Physical", description: "Inject venom through a bite, weakening a target over time.", rarity: "common" },
  { key: "ceiling_stalk", name: "Ceiling Stalk", family: "Shadow", type: "Movement", description: "Move across high surfaces while watching prey from above.", rarity: "common" },
  { key: "scavenge", name: "Scavenge", family: "Survival", type: "Utility", description: "Find useful scraps, food, and weak points in ruined places.", rarity: "common" },
  { key: "cheap_shot", name: "Cheap Shot", family: "Survival", type: "Physical", description: "Strike a distracted enemy where discipline cannot protect them.", rarity: "common" },
  { key: "pack_signal", name: "Pack Signal", family: "Command", type: "Support", description: "Signal nearby allies or creatures with crude but effective calls.", rarity: "common" },
  { key: "tunnel_step", name: "Tunnel Step", family: "Survival", type: "Movement", description: "Move quickly through tight passages, loose stone, and cramped routes.", rarity: "common" },
  { key: "snare_craft", name: "Snare Craft", family: "Survival", type: "Trap", description: "Shape simple traps from debris, roots, wire, or broken tools.", rarity: "common" },
  { key: "ore_nose", name: "Ore Nose", family: "Survival", type: "Sense", description: "Smell metal, minerals, and buried tools through damp stone.", rarity: "common" },
  { key: "blood_scent", name: "Blood Scent", family: "Predator", type: "Sense", description: "Track wounded creatures by blood, fear, and heat.", rarity: "common" },
  { key: "pounce", name: "Pounce", family: "Predator", type: "Physical", description: "Launch into a sudden body-first attack to knock prey off balance.", rarity: "common" },
  { key: "howl", name: "Howl", family: "Command", type: "Spirit", description: "Release a pressure-filled cry that warns, threatens, or rallies.", rarity: "common" },
  { key: "bone_guard", name: "Bone Guard", family: "Undead", type: "Defense", description: "Lock bones into a defensive frame that dulls pain and impact.", rarity: "common" },
  { key: "deathless_step", name: "Deathless Step", family: "Undead", type: "Movement", description: "Move without breath, fatigue tells, or living hesitation.", rarity: "common" },
  { key: "grave_chill", name: "Grave Chill", family: "Undead", type: "Dark", description: "Bleed cold death-mana into the air around a target.", rarity: "uncommon" },
  { key: "echo_pulse", name: "Echo Pulse", family: "Beast", type: "Sense", description: "Read nearby space through sound and returning vibration.", rarity: "common" },
  { key: "dive_bite", name: "Dive Bite", family: "Beast", type: "Physical", description: "Drop from above and bite with speed instead of strength.", rarity: "common" },
  { key: "wing_feint", name: "Wing Feint", family: "Beast", type: "Movement", description: "Use wingbeats and sudden shifts to mislead an enemy's timing.", rarity: "common" },
  { key: "false_shape", name: "False Shape", family: "Mimic", type: "Deception", description: "Hold a harmless shape until prey trusts the lie.", rarity: "uncommon" },
  { key: "clamp", name: "Clamp", family: "Mimic", type: "Physical", description: "Snap shut and hold with patient, crushing force.", rarity: "common" },
  { key: "treasure_scent", name: "Treasure Scent", family: "Mimic", type: "Sense", description: "Sense handled valuables, greedy attention, and hidden caches.", rarity: "common" },
  { key: "analyze", name: "Analyze", family: "Arcane", type: "Support", description: "Study a creature, object, or trace to reveal useful story clues.", rarity: "uncommon" },
  { key: "predator_instinct", name: "Predator Instinct", family: "Predator", type: "Passive", description: "Feel danger before an ambush fully reveals itself.", rarity: "rare" },
  { key: "soul_echo", name: "Soul Echo", family: "Soul", type: "Memory", description: "Hear fragments of old fear, death, or promise clinging to a place.", rarity: "rare" }
];

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
  const currentBody = parseJson(row.current_body, null);
  const activeCharacter = row.character_id ? {
    id: Number(row.character_id),
    characterName: row.character_name,
    race: row.race,
    className: row.class_name,
    level: Number(row.character_level || 1),
    hp: Number(row.hp || 100),
    maxHp: Number(row.max_hp || 100),
    mana: Number(row.mana || 30),
    maxMana: Number(row.max_mana || 30),
    stamina: Number(row.stamina || 50),
    maxStamina: Number(row.max_stamina || 50),
    strength: Number(row.strength || 5),
    agility: Number(row.agility || 5),
    defense: Number(row.defense || 5),
    thaumaturgy: Number(row.thaumaturgy || 5),
    resolve: Number(row.resolve_stat || 5),
    intelligence: Number(row.intelligence || 5),
    luck: Number(row.luck || 5),
    charisma: Number(row.charisma || 5),
    gold: Number(row.gold || 0),
    soulEnergy: Number(row.soul_energy || 0),
    dungeon: Number(row.character_dungeon || 1),
    floor: Number(row.character_floor || 1),
    status: row.character_status || "alive"
  } : null;

  return {
    playerId: row.player_id,
    username: row.username || row.player_id,
    email: row.email,
    narratorPersona: normalizePersona(row.narrator_persona),
    currentRun: Number(row.current_run || 1),
    cycleClears: Number(row.cycle_clears || 0),
    currentBody,
    activeCharacter,
    memoryLog: parseJson(row.memory_log, []),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

function normalizePersona(persona) {
  const normalized = String(persona || "ADMIN").trim().toUpperCase();
  return allowedPersonas.has(normalized) ? normalized : "ADMIN";
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateUsername(username) {
  const normalized = normalizeUsername(username);
  return /^[a-z0-9_]{3,24}$/.test(normalized) ? normalized : "";
}

function skillKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
      username VARCHAR(40) NULL UNIQUE,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(180) NOT NULL,
      narrator_persona VARCHAR(24) NOT NULL DEFAULT 'ADMIN',
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
    await ensureUsernameColumn();
    await ensurePersonaColumn();
    await ensureNarratorPersonaSchema();
    await ensureCharacterSchema();
    await ensureSkillSchema();
    await seedNarratorPersonas();
    await seedSkills();
    await backfillActiveCharacters();
  } catch (error) {
    schemaReady = null;
    throw error;
  }

  return schemaReady;
}

async function ensureUsernameColumn() {
  try {
    await db.execute("ALTER TABLE deep_saga_players ADD COLUMN username VARCHAR(40) NULL UNIQUE AFTER player_id");
  } catch (error) {
    const message = String(error.message || "").toLowerCase();

    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }

  await db.execute("UPDATE deep_saga_players SET username = LOWER(REPLACE(player_id, '-', '_')) WHERE username IS NULL OR username = ''");
}

async function ensurePersonaColumn() {
  try {
    await db.execute("ALTER TABLE deep_saga_players ADD COLUMN narrator_persona VARCHAR(24) NOT NULL DEFAULT 'ADMIN' AFTER password_hash");
  } catch (error) {
    const message = String(error.message || "").toLowerCase();

    if (message.includes("duplicate") || message.includes("exists")) {
      return;
    }

    throw error;
  }
}

async function ensureNarratorPersonaSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS narrator_persona (
      persona_key VARCHAR(24) NOT NULL PRIMARY KEY,
      role_name VARCHAR(120) NOT NULL,
      tone VARCHAR(255) NOT NULL,
      style_text TEXT NOT NULL,
      lore_format VARCHAR(255) NOT NULL,
      choice_bias VARCHAR(255) NOT NULL,
      hint_style VARCHAR(255) NOT NULL,
      failure_style VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureCharacterSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS player_characters (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(32) NOT NULL,
      run_number INT NOT NULL DEFAULT 1,
      active_character TINYINT NOT NULL DEFAULT 1,
      character_name VARCHAR(120) NULL,
      species VARCHAR(80) NULL,
      race VARCHAR(80) NULL,
      class_name VARCHAR(100) NULL,
      level INT NOT NULL DEFAULT 1,
      xp INT NOT NULL DEFAULT 0,
      xp_needed INT NOT NULL DEFAULT 100,
      hp INT NOT NULL DEFAULT 100,
      max_hp INT NOT NULL DEFAULT 100,
      mana INT NOT NULL DEFAULT 30,
      max_mana INT NOT NULL DEFAULT 30,
      stamina INT NOT NULL DEFAULT 50,
      max_stamina INT NOT NULL DEFAULT 50,
      strength INT NOT NULL DEFAULT 5,
      agility INT NOT NULL DEFAULT 5,
      defense INT NOT NULL DEFAULT 5,
      thaumaturgy INT NOT NULL DEFAULT 5,
      resolve_stat INT NOT NULL DEFAULT 5,
      intelligence INT NOT NULL DEFAULT 5,
      luck INT NOT NULL DEFAULT 5,
      charisma INT NOT NULL DEFAULT 5,
      gold INT NOT NULL DEFAULT 0,
      soul_energy INT NOT NULL DEFAULT 0,
      dungeon INT NOT NULL DEFAULT 1,
      floor INT NOT NULL DEFAULT 1,
      status VARCHAR(40) NOT NULL DEFAULT 'alive',
      appearance_json JSON NULL,
      traits_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_player_characters_player (player_id),
      INDEX idx_player_characters_active (player_id, active_character)
    )
  `);
}

async function ensureSkillSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS skills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      skill_key VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      family VARCHAR(80) NOT NULL,
      skill_type VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      rarity VARCHAR(40) NOT NULL DEFAULT 'common',
      unlock_rule TEXT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS player_character_skills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      character_id BIGINT UNSIGNED NOT NULL,
      skill_id BIGINT UNSIGNED NOT NULL,
      skill_level INT NOT NULL DEFAULT 1,
      xp INT NOT NULL DEFAULT 0,
      unlocked TINYINT NOT NULL DEFAULT 1,
      equipped TINYINT NOT NULL DEFAULT 0,
      last_used_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_character_skill (character_id, skill_id),
      INDEX idx_player_character_skills_character (character_id),
      INDEX idx_player_character_skills_skill (skill_id)
    )
  `);
}

async function seedNarratorPersonas() {
  for (const persona of narratorPersonas) {
    await db.execute(
      `INSERT INTO narrator_persona (persona_key, role_name, tone, style_text, lore_format, choice_bias, hint_style, failure_style, description, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), tone = VALUES(tone), style_text = VALUES(style_text), lore_format = VALUES(lore_format), choice_bias = VALUES(choice_bias), hint_style = VALUES(hint_style), failure_style = VALUES(failure_style), description = VALUES(description), active = 1`,
      [persona.key, persona.role, persona.tone, persona.style, persona.loreFormat, persona.choiceBias, persona.hintStyle, persona.failureStyle, persona.description]
    );
  }
}

async function seedSkills() {
  for (const skill of skillCatalog) {
    await db.execute(
      `INSERT INTO skills (skill_key, name, family, skill_type, description, rarity, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), family = VALUES(family), skill_type = VALUES(skill_type), description = VALUES(description), rarity = VALUES(rarity), active = 1`,
      [skill.key, skill.name, skill.family, skill.type, skill.description, skill.rarity]
    );
  }
}

function characterStatsFromBody(body) {
  return {
    characterName: body.name || `${body.race || "Unknown"} Soul`,
    race: body.race || "Unknown",
    className: body.class || "Reincarnated Monster",
    level: Number(body.level || 1),
    hp: Number(body.hp || body.maxHp || 100),
    maxHp: Number(body.maxHp || 100),
    mana: Number(body.mana || body.maxMana || 30),
    maxMana: Number(body.maxMana || 30),
    stamina: Number(body.stamina || body.maxStamina || 50),
    maxStamina: Number(body.maxStamina || 50),
    strength: Number(body.strength || 5),
    agility: Number(body.agility || 5),
    defense: Number(body.defense || 5),
    thaumaturgy: Number(body.thaumaturgy || 5),
    resolve: Number(body.resolve || body.resolve_stat || 5),
    intelligence: Number(body.intelligence || 5),
    luck: Number(body.luck || 5),
    charisma: Number(body.charisma || 5),
    gold: Number(body.gold || 0),
    soulEnergy: Number(body.soulEnergy || body.soul_energy || 0),
    dungeon: Number(body.dungeon || 1),
    floor: Number(body.floor || 1),
    status: body.status === "dead" ? "dead" : "alive"
  };
}

async function createCharacterForPlayer(playerId, runNumber, body) {
  const stats = characterStatsFromBody(body || {});
  await db.execute("UPDATE player_characters SET active_character = 0 WHERE player_id = ?", [playerId]);
  await db.execute(
    `INSERT INTO player_characters (player_id, run_number, active_character, character_name, species, race, class_name, level, xp, xp_needed, hp, max_hp, mana, max_mana, stamina, max_stamina, strength, agility, defense, thaumaturgy, resolve_stat, intelligence, luck, charisma, gold, soul_energy, dungeon, floor, status, appearance_json, traits_json)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, 0, 100, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      playerId,
      Number(runNumber || 1),
      stats.characterName,
      stats.race,
      stats.race,
      stats.className,
      stats.level,
      stats.hp,
      stats.maxHp,
      stats.mana,
      stats.maxMana,
      stats.stamina,
      stats.maxStamina,
      stats.strength,
      stats.agility,
      stats.defense,
      stats.thaumaturgy,
      stats.resolve,
      stats.intelligence,
      stats.luck,
      stats.charisma,
      stats.gold,
      stats.soulEnergy,
      stats.dungeon,
      stats.floor,
      stats.status,
      JSON.stringify({ strengths: body.strengths || [], weaknesses: body.weaknesses || [] }),
      JSON.stringify({ evolutionPaths: body.evolutionPaths || [] })
    ]
  );

  const rows = await db.query(
    "SELECT id FROM player_characters WHERE player_id = ? AND active_character = 1 ORDER BY id DESC LIMIT 1",
    [playerId]
  );
  const characterId = rows[0]?.id;

  if (characterId) {
    await assignStartingSkills(characterId, body.skills || []);
  }

  return characterId;
}

async function assignStartingSkills(characterId, skillNames) {
  for (const name of skillNames) {
    const key = skillKey(name);
    if (!key) continue;

    let rows = await db.query("SELECT id FROM skills WHERE skill_key = ? LIMIT 1", [key]);
    if (!rows[0]) {
      await db.execute(
        "INSERT INTO skills (skill_key, name, family, skill_type, description, rarity, active) VALUES (?, ?, 'Survival', 'Innate', ?, 'common', 1) ON DUPLICATE KEY UPDATE active = 1",
        [key, name, `${name} is an innate skill awakened by the current body.`]
      );
      rows = await db.query("SELECT id FROM skills WHERE skill_key = ? LIMIT 1", [key]);
    }

    if (rows[0]) {
      await db.execute(
        "INSERT INTO player_character_skills (character_id, skill_id, skill_level, xp, unlocked, equipped) VALUES (?, ?, 1, 0, 1, 0) ON DUPLICATE KEY UPDATE unlocked = 1",
        [characterId, rows[0].id]
      );
    }
  }
}

async function backfillActiveCharacters() {
  const players = await db.query(
    `SELECT p.player_id, p.current_run, p.current_body
       FROM deep_saga_players p
       LEFT JOIN player_characters c ON c.player_id = p.player_id AND c.active_character = 1
      WHERE c.id IS NULL
      LIMIT 200`
  );

  for (const player of players) {
    await createCharacterForPlayer(player.player_id, player.current_run, parseJson(player.current_body, {}));
  }
}

async function listNarratorPersonas() {
  await ensurePlayerSchema();
  const rows = await db.query(
    "SELECT persona_key, role_name, description, tone, style_text, active FROM narrator_persona WHERE active = 1 ORDER BY FIELD(persona_key, 'ADMIN', 'TRICKSTER', 'SENSEI'), persona_key"
  );

  return rows.map((row) => ({
    key: row.persona_key,
    name: row.role_name,
    description: row.description,
    tone: row.tone,
    style: row.style_text
  }));
}

async function findPlayerByIdentifier(identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const rows = await db.query(
    `SELECT p.player_id, p.username, p.email, p.password_hash, p.narrator_persona, p.current_run, p.cycle_clears, p.current_body, p.memory_log, p.created_at, p.last_login_at,
            c.id AS character_id, c.character_name, c.race, c.class_name, c.level AS character_level, c.hp, c.max_hp, c.mana, c.max_mana, c.stamina, c.max_stamina,
            c.strength, c.agility, c.defense, c.thaumaturgy, c.resolve_stat, c.intelligence, c.luck, c.charisma, c.gold, c.soul_energy,
            c.dungeon AS character_dungeon, c.floor AS character_floor, c.status AS character_status
       FROM deep_saga_players p
       LEFT JOIN player_characters c ON c.player_id = p.player_id AND c.active_character = 1
      WHERE LOWER(p.email) = ? OR LOWER(p.username) = ? OR LOWER(p.player_id) = ?
      LIMIT 1`,
    [normalized, normalized, normalized]
  );

  return rows[0] || null;
}

async function updatePlayerPersona(playerId, persona) {
  await ensurePlayerSchema();

  const narratorPersona = normalizePersona(persona);
  await db.execute(
    "UPDATE deep_saga_players SET narrator_persona = ? WHERE player_id = ?",
    [narratorPersona, playerId]
  );

  const player = await findPlayerByIdentifier(playerId);
  return serializePlayer(player);
}

async function registerPlayer({ username, email, password }) {
  await ensurePlayerSchema();

  const normalizedUsername = validateUsername(username);
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
        "INSERT INTO deep_saga_players (player_id, username, email, password_hash, current_body, memory_log) VALUES (?, ?, ?, ?, ?, ?)",
        [playerId, normalizedUsername, normalizedEmail, passwordHash, JSON.stringify(body), JSON.stringify(memories)]
      );
      await createCharacterForPlayer(playerId, 1, body);

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
  listNarratorPersonas,
  loginPlayer,
  monsterRaces,
  normalizePersona,
  normalizeUsername,
  randomMonsterBody,
  registerPlayer,
  serializePlayer,
  updatePlayerPersona,
  validateUsername
};
