const crypto = require("crypto");
const db = require("../db");
const { hashPassword, verifyPassword } = require("../utils/password");

const monsterRaces = [
  {
    race: "Reincarnated Slime",
    archetype: "Reincarnated as a Slime",
    storyMode: "Starts weak but can become extremely powerful by absorbing, adapting, and evolving from battle.",
    strengths: ["adaptive body", "absorption", "silent movement", "rapid evolution potential"],
    weaknesses: ["almost no starting strength", "vulnerable to heat", "easy to underestimate and crush early"],
    skills: ["Appraisal", "Predator", "Mana Control"],
    evolutionPaths: ["Tiny Slime", "Blue Slime", "Magic Slime", "Predator Slime", "Great Slime", "King Slime", "Demon Slime", "Chaos Slime", "Primordial Slime"],
    reincarnationEvolutionHints: ["Slime Emperor", "Chaos Lord", "Void Monarch", "Primordial Beast"],
    hp: 72,
    maxHp: 72,
    mana: 34,
    maxMana: 34,
    stamina: 46,
    maxStamina: 46,
    strength: 2,
    agility: 5,
    defense: 4,
    thaumaturgy: 7,
    resolve: 6,
    intelligence: 7,
    luck: 5,
    charisma: 2
  },
  {
    race: "Reincarnated Spider",
    archetype: "Reincarnated as a Spider",
    storyMode: "Starts extremely weak and survives through traps, venom, fear, analysis, and brutal adaptation.",
    strengths: ["web control", "wall crawling", "ambush instincts", "venom potential"],
    weaknesses: ["fragile frame", "weak against fire", "can be killed by one careless choice early"],
    skills: ["Appraisal", "Poison Fang", "Web Trap"],
    evolutionPaths: ["Small Spider", "Poison Spider", "Web Hunter", "Venom Taratect", "Greater Taratect", "Ancient Taratect", "Abyss Spider", "Divine Spider"],
    reincarnationEvolutionHints: ["Time Spider", "Abyss King", "Soul Reaper", "Eternal Sage"],
    hp: 48,
    maxHp: 48,
    mana: 28,
    maxMana: 28,
    stamina: 64,
    maxStamina: 64,
    strength: 3,
    agility: 8,
    defense: 2,
    thaumaturgy: 4,
    resolve: 8,
    intelligence: 8,
    luck: 6,
    charisma: 1
  }
];

const evolutionCatalog = {
  slime: ["Tiny Slime", "Blue Slime", "Magic Slime", "Predator Slime", "Great Slime", "King Slime", "Demon Slime", "Chaos Slime", "Primordial Slime"],
  spider: ["Small Spider", "Poison Spider", "Web Hunter", "Venom Taratect", "Greater Taratect", "Ancient Taratect", "Abyss Spider", "Divine Spider"],
  dragon: ["Baby Dragon", "Young Dragon", "Wyvern", "Ancient Dragon", "Elder Dragon", "Dragon Lord", "True Dragon"],
  demon: ["Imp", "Greater Demon", "Demon General", "Arch Demon", "Demon Lord", "Demon Emperor"],
  angel: ["Angel Path"],
  reincarnation: ["Void Dragon", "Time Spider", "Slime Emperor", "Soul Reaper"],
  endgame: ["Dragon God", "Chaos Lord", "World Tree Guardian", "Void Monarch", "Abyss King", "Celestial Emperor", "Primordial Beast", "Phoenix Lord", "Titan King", "Eternal Sage"]
};

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
  { key: "appraisal", name: "Appraisal", family: "Support", type: "Support", description: "Reveals enemy stats, weaknesses, and loot.", rarity: "common" },
  { key: "predator", name: "Predator", family: "Unique", type: "Unique", description: "Consume enemies to gain skills or traits.", rarity: "unique" },
  { key: "regeneration", name: "Regeneration", family: "Passive", type: "Passive", description: "Restores HP over time.", rarity: "uncommon" },
  { key: "mana_control", name: "Mana Control", family: "Passive", type: "Passive", description: "Reduces MP cost of abilities.", rarity: "common" },
  { key: "shadow_step", name: "Shadow Step", family: "Active", type: "Active", description: "Teleport a short distance instantly.", rarity: "rare" },
  { key: "poison_fang", name: "Poison Fang", family: "Attack", type: "Attack", description: "Inflicts poison damage over time.", rarity: "common" },
  { key: "fireball", name: "Fireball", family: "Magic", type: "Magic", description: "Launches a fire projectile.", rarity: "common" },
  { key: "ice_lance", name: "Ice Lance", family: "Magic", type: "Magic", description: "Pierces enemies and may freeze them.", rarity: "uncommon" },
  { key: "thunder_strike", name: "Thunder Strike", family: "Magic", type: "Magic", description: "Calls lightning from above.", rarity: "rare" },
  { key: "berserk", name: "Berserk", family: "Buff", type: "Buff", description: "Greatly increases attack but lowers defense.", rarity: "uncommon" },
  { key: "stealth", name: "Stealth", family: "Utility", type: "Utility", description: "Become nearly invisible.", rarity: "common" },
  { key: "web_trap", name: "Web Trap", family: "Utility", type: "Utility", description: "Immobilizes enemies.", rarity: "common" },
  { key: "blood_drain", name: "Blood Drain", family: "Attack", type: "Attack", description: "Steals HP from enemies.", rarity: "rare" },
  { key: "earth_wall", name: "Earth Wall", family: "Defense", type: "Defense", description: "Creates a protective barrier.", rarity: "uncommon" },
  { key: "wind_dash", name: "Wind Dash", family: "Mobility", type: "Mobility", description: "Greatly increases movement speed.", rarity: "common" },
  { key: "critical_eye", name: "Critical Eye", family: "Passive", type: "Passive", description: "Increases critical hit chance.", rarity: "uncommon" },
  { key: "dragon_roar", name: "Dragon Roar", family: "Ultimate", type: "Ultimate", description: "Stuns nearby enemies.", rarity: "epic" },
  { key: "time_slow", name: "Time Slow", family: "Ultimate", type: "Ultimate", description: "Slows all enemies in an area.", rarity: "epic" },
  { key: "soul_harvest", name: "Soul Harvest", family: "Legendary", type: "Legendary", description: "Gain Soul Essence from defeated foes.", rarity: "legendary" },
  { key: "void_slash", name: "Void Slash", family: "Mythic", type: "Mythic", description: "Ignores armor and cuts through dimensions.", rarity: "mythic" }
];

const skillNames = skillCatalog.map((skill) => skill.name);

const dungeonCount = 10;
const floorsPerDungeon = 1;
const startingDungeonName = "The Rebirth Crucible";
const startingFloorName = "Boss 1: Gloria Taratect";

const bossGauntlet = [
  {
    sequence: 1,
    name: "Gloria Taratect",
    title: "Evolved Giant Spider",
    sourceWorld: "Spider Reincarnation",
    powerRank: 10,
    maxHp: 120,
    profile: "A durable evolved spider that serves the Queen Taratect and tests whether a newborn soul understands movement, traps, and timing.",
    combatStyle: "web pressure, armored legs, sudden lunges",
    openingAttitude: "cocky and dismissive"
  },
  {
    sequence: 2,
    name: "Clayman",
    title: "Manipulative Demon Lord",
    sourceWorld: "Slime Reincarnation",
    powerRank: 9,
    maxHp: 180,
    profile: "A schemer who relies on puppets, fear, mind pressure, and staged advantages more than raw strength.",
    combatStyle: "mind control, summoned soldiers, dirty bargains",
    openingAttitude: "condescending"
  },
  {
    sequence: 3,
    name: "Araba",
    title: "Earth Dragon",
    sourceWorld: "Spider Reincarnation",
    powerRank: 8,
    maxHp: 260,
    profile: "A disciplined dragon whose raw physical control forces the player to earn every opening.",
    combatStyle: "stone breath, disciplined counters, crushing endurance",
    openingAttitude: "silent and honorable"
  },
  {
    sequence: 4,
    name: "Mother (Queen Taratect)",
    title: "Queen Spider",
    sourceWorld: "Spider Reincarnation",
    powerRank: 7,
    maxHp: 340,
    profile: "A giant queen spider commanding countless offspring through pressure, instinct, and brood authority.",
    combatStyle: "brood control, psychic pressure, layered webs",
    openingAttitude: "possessive and predatory"
  },
  {
    sequence: 5,
    name: "Hinata Sakaguchi",
    title: "Holy Knight Commander",
    sourceWorld: "Slime Reincarnation",
    powerRank: 6,
    maxHp: 430,
    profile: "A master swordswoman whose anti-monster techniques punish reckless monster instincts.",
    combatStyle: "holy sword forms, analysis, anti-monster seals",
    openingAttitude: "coldly focused"
  },
  {
    sequence: 6,
    name: "Demon Lord Ariel",
    title: "Ancient Demon Ruler",
    sourceWorld: "Spider Reincarnation",
    powerRank: 5,
    maxHp: 540,
    profile: "A centuries-old demon ruler with overwhelming experience and calm battlefield cruelty.",
    combatStyle: "ancient magic, close combat mastery, regeneration",
    openingAttitude: "amused but alert"
  },
  {
    sequence: 7,
    name: "Milim Nava",
    title: "Catastrophe Demon Lord",
    sourceWorld: "Slime Reincarnation",
    powerRank: 4,
    maxHp: 680,
    profile: "A childlike ancient demon lord whose cheerful mood hides nation-breaking force.",
    combatStyle: "catastrophic strength, flight, explosive magic",
    openingAttitude: "playful and careless"
  },
  {
    sequence: 8,
    name: "Veldora Tempest",
    title: "Storm Dragon",
    sourceWorld: "Slime Reincarnation",
    powerRank: 3,
    maxHp: 840,
    profile: "A True Dragon of storm and destruction whose presence turns the arena into weather.",
    combatStyle: "storm aura, dragon magic, destructive breath",
    openingAttitude: "loudly overconfident"
  },
  {
    sequence: 9,
    name: "Guy Crimson",
    title: "Primordial Demon Lord",
    sourceWorld: "Slime Reincarnation",
    powerRank: 2,
    maxHp: 1020,
    profile: "The strongest demon lord, feared for near-unmatched power, patience, and impossible reads.",
    combatStyle: "primordial magic, perfect counters, domination pressure",
    openingAttitude: "politely terrifying"
  },
  {
    sequence: 10,
    name: "Administrator D",
    title: "Mirror Administrator",
    sourceWorld: "Spider Reincarnation",
    powerRank: 1,
    maxHp: 1400,
    profile: "A godlike administrator who appears as the player's perfected self: what the soul could become through ruthless effort.",
    combatStyle: "system rewriting, mirror choices, impossible observation",
    openingAttitude: "playful, clinical, and personal"
  }
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
    xp: Number(row.character_xp || 0),
    xpNeeded: Number(row.character_xp_needed || 100),
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
  const floorRuntime = {
    dungeonNumber: Number(row.runtime_dungeon_number || activeCharacter?.dungeon || currentBody?.dungeon || 1),
    floorNumber: Number(row.runtime_floor_number || activeCharacter?.floor || currentBody?.floor || 1),
    dungeonLabel: row.dungeon_label || `Dungeon ${Number(row.runtime_dungeon_number || activeCharacter?.dungeon || currentBody?.dungeon || 1)}`,
    floorLabel: row.floor_label || `Dungeon ${Number(row.runtime_dungeon_number || activeCharacter?.dungeon || currentBody?.dungeon || 1)} Floor ${Number(row.runtime_floor_number || activeCharacter?.floor || currentBody?.floor || 1)}`,
    dungeonAiName: row.dungeon_ai_name || null,
    floorAiName: row.floor_ai_name || null,
    floorRole: row.floor_role || (Number(row.runtime_floor_number || activeCharacter?.floor || currentBody?.floor || 1) === floorsPerDungeon ? "boss" : "exploration"),
    isBossFloor: Boolean(Number(row.is_boss_floor || 0)),
    isFinalBossFloor: Boolean(Number(row.is_final_boss_floor || 0))
  };

  return {
    playerId: row.player_id,
    username: row.username || row.player_id,
    email: row.email,
    narratorPersona: normalizePersona(row.narrator_persona),
    currentRun: Number(row.current_run || 1),
    cycleClears: Number(row.cycle_clears || 0),
    currentBody,
    activeCharacter,
    floorRuntime,
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
    await ensureWorldProgressionSchema();
    await ensureBossSchema();
    await ensureCharacterSchema();
    await ensureSkillSchema();
    await ensureStoryMemorySchema();
    await ensureLegacyHeroSchema();
    await seedWorldProgression();
    await seedBossGauntlet();
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

async function ensureWorldProgressionSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dungeons (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      dungeon_number INT NOT NULL UNIQUE,
      canonical_label VARCHAR(40) NOT NULL,
      ai_name VARCHAR(160) NULL,
      ai_name_note TEXT NULL,
      is_final_dungeon TINYINT NOT NULL DEFAULT 0,
      active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dungeons_number (dungeon_number)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS dungeon_floors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      dungeon_number INT NOT NULL,
      floor_number INT NOT NULL,
      canonical_label VARCHAR(40) NOT NULL,
      ai_name VARCHAR(160) NULL,
      ai_name_note TEXT NULL,
      floor_role VARCHAR(80) NOT NULL,
      is_boss_floor TINYINT NOT NULL DEFAULT 0,
      is_final_boss_floor TINYINT NOT NULL DEFAULT 0,
      active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_dungeon_floor (dungeon_number, floor_number),
      INDEX idx_dungeon_floors_dungeon (dungeon_number),
      INDEX idx_dungeon_floors_boss (is_boss_floor)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_location_names (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(32) NULL,
      run_number INT NULL,
      dungeon_number INT NOT NULL,
      floor_number INT NULL,
      name_type VARCHAR(40) NOT NULL,
      ai_name VARCHAR(160) NOT NULL,
      source_text TEXT NULL,
      accepted TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ai_location_names_position (dungeon_number, floor_number),
      INDEX idx_ai_location_names_player (player_id, run_number)
    )
  `);
}

async function ensureBossSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS story_bosses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      boss_sequence INT NOT NULL UNIQUE,
      boss_name VARCHAR(120) NOT NULL,
      boss_title VARCHAR(160) NOT NULL,
      source_world VARCHAR(120) NOT NULL,
      power_rank INT NOT NULL,
      max_hp INT NOT NULL DEFAULT 100,
      dungeon_number INT NOT NULL,
      floor_number INT NOT NULL DEFAULT 1,
      profile TEXT NOT NULL,
      combat_style TEXT NOT NULL,
      opening_attitude VARCHAR(160) NOT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_story_bosses_stage (dungeon_number, floor_number),
      INDEX idx_story_bosses_power (power_rank)
    )
  `);

  await ensureBossColumn("max_hp", "INT NOT NULL DEFAULT 100");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS player_boss_progress (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(32) NOT NULL,
      run_number INT NOT NULL,
      boss_sequence INT NOT NULL,
      boss_name VARCHAR(120) NOT NULL,
      current_hp INT NOT NULL,
      max_hp INT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      defeated_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_player_run_boss (player_id, run_number, boss_sequence),
      INDEX idx_player_boss_progress_player (player_id, run_number),
      INDEX idx_player_boss_progress_status (status)
    )
  `);
}

async function ensureBossColumn(columnName, definition) {
  try {
    await db.execute(`ALTER TABLE story_bosses ADD COLUMN ${columnName} ${definition}`);
  } catch (error) {
    const message = String(error.message || "").toLowerCase();

    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }
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

  await ensureCharacterColumn("xp", "INT NOT NULL DEFAULT 0");
  await ensureCharacterColumn("xp_needed", "INT NOT NULL DEFAULT 100");
}

async function ensureCharacterColumn(columnName, definition) {
  try {
    await db.execute(`ALTER TABLE player_characters ADD COLUMN ${columnName} ${definition}`);
  } catch (error) {
    const message = String(error.message || "").toLowerCase();

    if (!message.includes("duplicate") && !message.includes("exists")) {
      throw error;
    }
  }
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

async function ensureStoryMemorySchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS story_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(32) NOT NULL,
      run_number INT NOT NULL DEFAULT 1,
      character_id BIGINT UNSIGNED NULL,
      dungeon_number INT NOT NULL DEFAULT 1,
      floor_number INT NOT NULL DEFAULT 1,
      speaker VARCHAR(24) NOT NULL,
      message_text TEXT NOT NULL,
      choices_json JSON NULL,
      state_changes_json JSON NULL,
      record_changes_json JSON NULL,
      memory_updates_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_story_messages_player_run (player_id, run_number, id),
      INDEX idx_story_messages_location (player_id, run_number, dungeon_number, floor_number)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS story_memory (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(32) NOT NULL,
      run_number INT NOT NULL DEFAULT 1,
      character_id BIGINT UNSIGNED NULL,
      memory_type VARCHAR(60) NOT NULL DEFAULT 'story',
      memory_text TEXT NOT NULL,
      facts_json JSON NULL,
      importance INT NOT NULL DEFAULT 1,
      remembered_across_lives TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_story_memory_player_run (player_id, run_number),
      INDEX idx_story_memory_across_lives (player_id, remembered_across_lives)
    )
  `);
}

async function ensureLegacyHeroSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS legacy_heroes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(32) NOT NULL,
      source_run_number INT NOT NULL,
      source_character_id BIGINT UNSIGNED NULL,
      hero_name VARCHAR(120) NULL,
      race VARCHAR(80) NULL,
      class_name VARCHAR(100) NULL,
      level INT NOT NULL DEFAULT 1,
      xp INT NOT NULL DEFAULT 0,
      hp INT NOT NULL DEFAULT 100,
      max_hp INT NOT NULL DEFAULT 100,
      mana INT NOT NULL DEFAULT 30,
      max_mana INT NOT NULL DEFAULT 30,
      stamina INT NOT NULL DEFAULT 50,
      max_stamina INT NOT NULL DEFAULT 50,
      stats_json JSON NULL,
      skills_json JSON NULL,
      inventory_json JSON NULL,
      titles_json JSON NULL,
      personality_json JSON NULL,
      combat_style_json JSON NULL,
      final_dungeon INT NOT NULL DEFAULT 10,
      final_floor INT NOT NULL DEFAULT 1,
      boss_intro_dialogue TEXT NULL,
      boss_defeat_dialogue TEXT NULL,
      locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_legacy_player_run (player_id, source_run_number),
      INDEX idx_legacy_heroes_player (player_id),
      INDEX idx_legacy_heroes_source (source_run_number)
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

async function seedWorldProgression() {
  for (let dungeon = 1; dungeon <= dungeonCount; dungeon += 1) {
    const boss = bossGauntlet[dungeon - 1];
    const dungeonAiName = dungeon === 1 ? startingDungeonName : `Boss ${dungeon}: ${boss?.name || `Unknown Boss ${dungeon}`}`;
    await db.execute(
      `INSERT INTO dungeons (dungeon_number, canonical_label, ai_name, ai_name_note, is_final_dungeon, active)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE canonical_label = VALUES(canonical_label), ai_name = VALUES(ai_name), ai_name_note = VALUES(ai_name_note), is_final_dungeon = VALUES(is_final_dungeon), active = 1`,
      [dungeon, `Boss Stage ${dungeon}`, dungeonAiName, "0.3 ten-boss reincarnation gauntlet.", dungeon === dungeonCount ? 1 : 0]
    );

    for (let floor = 1; floor <= floorsPerDungeon; floor += 1) {
      const isBossFloor = true;
      const isFinalBossFloor = dungeon === dungeonCount && floor === floorsPerDungeon;
      const floorRole = isFinalBossFloor ? "final_boss" : dungeon === 1 ? "opening_boss" : "boss";
      const floorAiName = dungeon === 1 && floor === 1 ? startingFloorName : `Boss ${dungeon}: ${boss?.name || `Unknown Boss ${dungeon}`}`;

      await db.execute(
        `INSERT INTO dungeon_floors (dungeon_number, floor_number, canonical_label, ai_name, ai_name_note, floor_role, is_boss_floor, is_final_boss_floor, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE canonical_label = VALUES(canonical_label), ai_name = VALUES(ai_name), ai_name_note = VALUES(ai_name_note), floor_role = VALUES(floor_role), is_boss_floor = VALUES(is_boss_floor), is_final_boss_floor = VALUES(is_final_boss_floor), active = 1`,
        [dungeon, floor, `Boss Stage ${dungeon}`, floorAiName, "0.3 combat boss stage.", floorRole, isBossFloor ? 1 : 0, isFinalBossFloor ? 1 : 0]
      );
    }
  }
}

async function seedBossGauntlet() {
  for (const boss of bossGauntlet) {
    await db.execute(
      `INSERT INTO story_bosses (boss_sequence, boss_name, boss_title, source_world, power_rank, max_hp, dungeon_number, floor_number, profile, combat_style, opening_attitude, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE boss_name = VALUES(boss_name), boss_title = VALUES(boss_title), source_world = VALUES(source_world), power_rank = VALUES(power_rank), max_hp = VALUES(max_hp), dungeon_number = VALUES(dungeon_number), floor_number = VALUES(floor_number), profile = VALUES(profile), combat_style = VALUES(combat_style), opening_attitude = VALUES(opening_attitude), active = 1`,
      [boss.sequence, boss.name, boss.title, boss.sourceWorld, boss.powerRank, boss.maxHp, boss.sequence, boss.profile, boss.combatStyle, boss.openingAttitude]
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

async function getFloorRuntime(dungeonNumber, floorNumber) {
  await ensurePlayerSchema();
  const dungeon = Number(dungeonNumber || 1);
  const floor = Number(floorNumber || 1);
  const rows = await db.query(
    `SELECT d.dungeon_number, d.canonical_label AS dungeon_label, d.ai_name AS dungeon_ai_name, d.is_final_dungeon,
            f.floor_number, f.canonical_label AS floor_label, f.ai_name AS floor_ai_name, f.floor_role, f.is_boss_floor, f.is_final_boss_floor
       FROM dungeons d
       JOIN dungeon_floors f ON f.dungeon_number = d.dungeon_number
      WHERE d.dungeon_number = ? AND f.floor_number = ?
      LIMIT 1`,
    [dungeon, floor]
  );

  if (!rows[0]) {
    return {
      dungeonNumber: dungeon,
      floorNumber: floor,
      dungeonLabel: `Boss Stage ${dungeon}`,
      floorLabel: `Boss Stage ${dungeon}`,
      dungeonAiName: null,
      floorAiName: null,
      floorRole: floor === floorsPerDungeon ? (dungeon === dungeonCount ? "final_boss" : "boss") : floor === 1 ? "introduction" : "main_danger",
      isBossFloor: floor === floorsPerDungeon,
      isFinalBossFloor: dungeon === dungeonCount && floor === floorsPerDungeon
    };
  }

  return {
    dungeonNumber: Number(rows[0].dungeon_number),
    floorNumber: Number(rows[0].floor_number),
    dungeonLabel: rows[0].dungeon_label,
    floorLabel: rows[0].floor_label,
    dungeonAiName: rows[0].dungeon_ai_name || null,
    floorAiName: rows[0].floor_ai_name || null,
    floorRole: rows[0].floor_role,
    isBossFloor: Boolean(Number(rows[0].is_boss_floor)),
    isFinalBossFloor: Boolean(Number(rows[0].is_final_boss_floor))
  };
}

async function createLegacyHeroForPlayer(playerId, runNumber) {
  await ensurePlayerSchema();

  const player = await findPlayerByIdentifier(playerId);
  if (!player) {
    throw new Error("Player not found for legacy hero creation.");
  }

  const serialized = serializePlayer(player);
  const character = serialized.activeCharacter;
  const body = serialized.currentBody || {};

  if (!character) {
    throw new Error("Active character not found for legacy hero creation.");
  }

  const skillRows = await db.query(
    `SELECT s.skill_key, s.name, s.family, s.skill_type, pcs.skill_level, pcs.xp, pcs.equipped
       FROM player_character_skills pcs
       JOIN skills s ON s.id = pcs.skill_id
      WHERE pcs.character_id = ?
      ORDER BY s.name`,
    [character.id]
  );

  const stats = {
    strength: character.strength,
    agility: character.agility,
    defense: character.defense,
    thaumaturgy: character.thaumaturgy,
    resolve: character.resolve,
    intelligence: character.intelligence,
    luck: character.luck,
    charisma: character.charisma,
    soulEnergy: character.soulEnergy
  };

  const skills = skillRows.map((skill) => ({
    key: skill.skill_key,
    name: skill.name,
    family: skill.family,
    type: skill.skill_type,
    level: Number(skill.skill_level || 1),
    xp: Number(skill.xp || 0),
    equipped: Boolean(Number(skill.equipped || 0))
  }));

  const combatStyle = {
    preferredSkills: skills.slice(0, 5).map((skill) => skill.name),
    recordedFromRun: Number(runNumber || serialized.currentRun || 1),
    note: "Detailed combat style will be expanded as more turn analytics are saved."
  };

  await db.execute(
    `INSERT INTO legacy_heroes (player_id, source_run_number, source_character_id, hero_name, race, class_name, level, xp, hp, max_hp, mana, max_mana, stamina, max_stamina, stats_json, skills_json, inventory_json, titles_json, personality_json, combat_style_json, final_dungeon, final_floor, boss_intro_dialogue, boss_defeat_dialogue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, 1, ?, ?)
     ON DUPLICATE KEY UPDATE source_character_id = VALUES(source_character_id), hero_name = VALUES(hero_name), race = VALUES(race), class_name = VALUES(class_name), level = VALUES(level), xp = VALUES(xp), hp = VALUES(hp), max_hp = VALUES(max_hp), mana = VALUES(mana), max_mana = VALUES(max_mana), stamina = VALUES(stamina), max_stamina = VALUES(max_stamina), stats_json = VALUES(stats_json), skills_json = VALUES(skills_json), inventory_json = VALUES(inventory_json), titles_json = VALUES(titles_json), personality_json = VALUES(personality_json), combat_style_json = VALUES(combat_style_json)`,
    [
      playerId,
      Number(runNumber || serialized.currentRun || 1),
      character.id,
      character.characterName,
      character.race,
      character.className,
      character.level,
      Number(body.xp || 0),
      character.hp,
      character.maxHp,
      character.mana,
      character.maxMana,
      character.stamina,
      character.maxStamina,
      JSON.stringify(stats),
      JSON.stringify(skills),
      JSON.stringify(body.inventory || []),
      JSON.stringify(body.titles || []),
      JSON.stringify(body.personality || {}),
      JSON.stringify(combatStyle),
      `The Dungeon remembers ${character.characterName || "the victorious soul"}.`,
      "The legacy breaks, but the memory remains."
    ]
  );

  const rows = await db.query(
    "SELECT * FROM legacy_heroes WHERE player_id = ? AND source_run_number = ? LIMIT 1",
    [playerId, Number(runNumber || serialized.currentRun || 1)]
  );

  return rows[0] || null;
}

async function reincarnatePlayerAfterDeath(playerId, previousRunNumber, deathMemory = "") {
  await ensurePlayerSchema();

  const previousRun = Number(previousRunNumber || 1);
  const nextRun = previousRun + 1;
  const body = randomMonsterBody();
  const memoryText = String(deathMemory || "The last body died, and the soul was dragged back to the beginning.").trim().slice(0, 4000);

  await db.execute("UPDATE player_characters SET active_character = 0, status = 'dead' WHERE player_id = ? AND run_number = ?", [playerId, previousRun]);
  await db.execute(
    "UPDATE deep_saga_players SET current_run = ?, current_body = ?, memory_log = JSON_ARRAY_APPEND(COALESCE(memory_log, JSON_ARRAY()), '$', ?) WHERE player_id = ?",
    [nextRun, JSON.stringify(body), memoryText, playerId]
  );

  const characterId = await createCharacterForPlayer(playerId, nextRun, body);

  await db.execute(
    `INSERT INTO story_memory (player_id, run_number, character_id, memory_type, memory_text, facts_json, importance, remembered_across_lives)
     VALUES (?, ?, ?, 'reincarnation', ?, ?, 5, 1)`,
    [
      playerId,
      nextRun,
      characterId,
      memoryText,
      JSON.stringify({
        previousRun,
        nextRun,
        newBody: body.race,
        reason: "death_reincarnation"
      })
    ]
  );

  return {
    run: nextRun,
    body,
    characterId
  };
}

async function getPlayerSheet(playerId) {
  await ensurePlayerSchema();

  const row = await findPlayerByIdentifier(playerId);
  if (!row) {
    return null;
  }

  const player = serializePlayer(row);
  const character = player.activeCharacter;
  const bossProgress = character
    ? await getBossProgress(player.playerId, player.currentRun, character.dungeon || 1)
    : null;
  const currentBossProfile = character
    ? bossGauntlet.find((boss) => boss.sequence === Number(character.dungeon || 1)) || bossGauntlet[0]
    : null;
  let skills = [];

  if (character?.id) {
    const skillRows = await db.query(
      `SELECT s.id, s.skill_key, s.name, s.family, s.skill_type, s.description, s.rarity,
              pcs.skill_level, pcs.xp, pcs.unlocked, pcs.equipped, pcs.last_used_at
         FROM player_character_skills pcs
         JOIN skills s ON s.id = pcs.skill_id
        WHERE pcs.character_id = ? AND pcs.unlocked = 1
        ORDER BY pcs.equipped DESC, s.family, s.name`,
      [character.id]
    );

    skills = skillRows.map((skill) => ({
      id: Number(skill.id),
      key: skill.skill_key,
      name: skill.name,
      family: skill.family,
      type: skill.skill_type,
      description: skill.description,
      rarity: skill.rarity,
      level: Number(skill.skill_level || 1),
      xp: Number(skill.xp || 0),
      equipped: Boolean(Number(skill.equipped || 0)),
      lastUsedAt: skill.last_used_at || null
    }));
  }

  return {
    player: {
      playerId: player.playerId,
      username: player.username,
      narratorPersona: player.narratorPersona,
      currentRun: player.currentRun,
      cycleClears: player.cycleClears
    },
    character,
    currentBody: player.currentBody,
    floorRuntime: player.floorRuntime,
    bossProgress,
    currentBossProfile,
    skills,
    memoryLog: player.memoryLog || []
  };
}

async function getBossProgress(playerId, runNumber, bossSequence) {
  await ensurePlayerSchema();

  const sequence = Math.max(1, Math.min(Number(bossSequence || 1), dungeonCount));
  const run = Number(runNumber || 1);
  const boss = bossGauntlet.find((entry) => entry.sequence === sequence) || bossGauntlet[0];
  const maxHp = Number(boss.maxHp || 100);

  await db.execute(
    `INSERT INTO player_boss_progress (player_id, run_number, boss_sequence, boss_name, current_hp, max_hp, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE boss_name = VALUES(boss_name), max_hp = VALUES(max_hp), current_hp = LEAST(current_hp, VALUES(max_hp))`,
    [playerId, run, sequence, boss.name, maxHp, maxHp]
  );

  const rows = await db.query(
    `SELECT player_id, run_number, boss_sequence, boss_name, current_hp, max_hp, status, defeated_at
       FROM player_boss_progress
      WHERE player_id = ? AND run_number = ? AND boss_sequence = ?
      LIMIT 1`,
    [playerId, run, sequence]
  );

  const row = rows[0] || {};
  return {
    bossSequence: Number(row.boss_sequence || sequence),
    bossName: row.boss_name || boss.name,
    currentHp: Number(row.current_hp ?? maxHp),
    maxHp: Number(row.max_hp || maxHp),
    status: row.status || "active",
    defeatedAt: row.defeated_at || null
  };
}

async function applyBossHpDelta({ playerId, runNumber, characterId, bossSequence, hpDelta }) {
  await ensurePlayerSchema();

  const delta = Math.max(-99999, Math.min(Number(hpDelta || 0), 99999));
  if (!playerId || !runNumber || !bossSequence || !delta) {
    return null;
  }

  const before = await getBossProgress(playerId, runNumber, bossSequence);
  if (before.status === "defeated") {
    return { before, after: before, delta: 0, defeated: true, alreadyDefeated: true };
  }

  const nextHp = Math.max(0, Math.min(before.maxHp, before.currentHp + delta));
  const defeated = nextHp <= 0;

  await db.execute(
    `UPDATE player_boss_progress
        SET current_hp = ?, status = ?, defeated_at = CASE WHEN ? = 1 THEN COALESCE(defeated_at, CURRENT_TIMESTAMP) ELSE defeated_at END
      WHERE player_id = ? AND run_number = ? AND boss_sequence = ?`,
    [nextHp, defeated ? "defeated" : "active", defeated ? 1 : 0, playerId, Number(runNumber || 1), Number(bossSequence || 1)]
  );

  const after = await getBossProgress(playerId, runNumber, bossSequence);
  let advancedToStage = null;

  if (defeated && characterId && Number(bossSequence) < dungeonCount) {
    advancedToStage = Number(bossSequence) + 1;
    await db.execute(
      "UPDATE player_characters SET dungeon = ?, floor = 1 WHERE id = ?",
      [advancedToStage, characterId]
    );
    await getBossProgress(playerId, runNumber, advancedToStage);
  }

  return {
    before,
    after,
    delta,
    defeated,
    advancedToStage
  };
}

async function awardCharacterSkill(characterId, skillInput) {
  await ensurePlayerSchema();

  const name = String(skillInput?.name || skillInput?.skillName || "").trim().slice(0, 120);
  if (!characterId || !name) {
    return null;
  }

  const key = skillKey(skillInput.skillKey || name);
  const family = String(skillInput.family || "Soul").trim().slice(0, 80);
  const type = String(skillInput.type || skillInput.skillType || "Awakened").trim().slice(0, 80);
  const description = String(skillInput.description || `${name} awakened through earned action and the Dungeon's judgment.`).trim().slice(0, 2000);
  const rarity = String(skillInput.rarity || "uncommon").trim().toLowerCase().slice(0, 40);
  const level = Math.max(1, Math.min(Number(skillInput.level || skillInput.skillLevel || 1), 10));
  const xp = Math.max(0, Math.min(Number(skillInput.xp || 0), 999999));

  await db.execute(
    `INSERT INTO skills (skill_key, name, family, skill_type, description, rarity, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), family = VALUES(family), skill_type = VALUES(skill_type), description = VALUES(description), rarity = VALUES(rarity), active = 1`,
    [key, name, family, type, description, rarity]
  );

  const rows = await db.query("SELECT id, skill_key, name, family, skill_type, description, rarity FROM skills WHERE skill_key = ? LIMIT 1", [key]);
  const skill = rows[0];
  if (!skill) {
    return null;
  }

  await db.execute(
    `INSERT INTO player_character_skills (character_id, skill_id, skill_level, xp, unlocked, equipped)
     VALUES (?, ?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE unlocked = 1, skill_level = GREATEST(skill_level, VALUES(skill_level)), xp = xp + VALUES(xp)`,
    [characterId, skill.id, level, xp, skillInput.equipped ? 1 : 0]
  );

  return {
    id: Number(skill.id),
    key: skill.skill_key,
    name: skill.name,
    family: skill.family,
    type: skill.skill_type,
    description: skill.description,
    rarity: skill.rarity,
    level
  };
}

async function applyCharacterResourceDeltas(characterId, deltas = {}) {
  await ensurePlayerSchema();

  if (!characterId) {
    return null;
  }

  const hpDelta = Math.max(-9999, Math.min(Number(deltas.hp || deltas.playerHpDelta || 0), 9999));
  const manaDelta = Math.max(-9999, Math.min(Number(deltas.mana || deltas.playerManaDelta || 0), 9999));
  const staminaDelta = Math.max(-9999, Math.min(Number(deltas.stamina || deltas.playerStaminaDelta || 0), 9999));
  const goldDelta = Math.max(-999999, Math.min(Number(deltas.gold || deltas.goldDelta || 0), 999999));

  if (!hpDelta && !manaDelta && !staminaDelta && !goldDelta) {
    return null;
  }

  const beforeRows = await db.query(
    "SELECT hp, max_hp, mana, max_mana, stamina, max_stamina, gold FROM player_characters WHERE id = ? LIMIT 1",
    [characterId]
  );
  const before = beforeRows[0] || null;

  await db.execute(
    `UPDATE player_characters
        SET hp = LEAST(max_hp, GREATEST(0, hp + ?)),
            mana = LEAST(max_mana, GREATEST(0, mana + ?)),
            stamina = LEAST(max_stamina, GREATEST(0, stamina + ?)),
            gold = GREATEST(0, gold + ?)
      WHERE id = ?`,
    [hpDelta, manaDelta, staminaDelta, goldDelta, characterId]
  );

  const rows = await db.query(
    "SELECT hp, max_hp, mana, max_mana, stamina, max_stamina, gold FROM player_characters WHERE id = ? LIMIT 1",
    [characterId]
  );

  return {
    before,
    after: rows[0] || null,
    deltas: {
      hp: hpDelta,
      mana: manaDelta,
      stamina: staminaDelta,
      gold: goldDelta
    }
  };
}

async function findPlayerByIdentifier(identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const rows = await db.query(
    `SELECT p.player_id, p.username, p.email, p.password_hash, p.narrator_persona, p.current_run, p.cycle_clears, p.current_body, p.memory_log, p.created_at, p.last_login_at,
            c.id AS character_id, c.character_name, c.race, c.class_name, c.level AS character_level, c.xp AS character_xp, c.xp_needed AS character_xp_needed, c.hp, c.max_hp, c.mana, c.max_mana, c.stamina, c.max_stamina,
            c.strength, c.agility, c.defense, c.thaumaturgy, c.resolve_stat, c.intelligence, c.luck, c.charisma, c.gold, c.soul_energy,
            c.dungeon AS character_dungeon, c.floor AS character_floor, c.status AS character_status,
            d.dungeon_number AS runtime_dungeon_number, d.canonical_label AS dungeon_label, d.ai_name AS dungeon_ai_name,
            f.floor_number AS runtime_floor_number, f.canonical_label AS floor_label, f.ai_name AS floor_ai_name, f.floor_role, f.is_boss_floor, f.is_final_boss_floor
       FROM deep_saga_players p
       LEFT JOIN player_characters c ON c.player_id = p.player_id AND c.active_character = 1
       LEFT JOIN dungeons d ON d.dungeon_number = COALESCE(c.dungeon, JSON_UNQUOTE(JSON_EXTRACT(p.current_body, '$.dungeon')), 1)
       LEFT JOIN dungeon_floors f ON f.dungeon_number = d.dungeon_number AND f.floor_number = COALESCE(c.floor, JSON_UNQUOTE(JSON_EXTRACT(p.current_body, '$.floor')), 1)
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
  applyCharacterResourceDeltas,
  applyBossHpDelta,
  awardCharacterSkill,
  bossGauntlet,
  createLegacyHeroForPlayer,
  ensurePlayerSchema,
  evolutionCatalog,
  getFloorRuntime,
  getBossProgress,
  getPlayerSheet,
  listNarratorPersonas,
  loginPlayer,
  monsterRaces,
  normalizePersona,
  normalizeUsername,
  randomMonsterBody,
  reincarnatePlayerAfterDeath,
  registerPlayer,
  serializePlayer,
  skillNames,
  updatePlayerPersona,
  validateUsername
};
