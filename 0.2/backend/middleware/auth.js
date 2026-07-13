const db = require("../db");
const { verifyToken } = require("../utils/token");
const { serializePlayer } = require("../services/player.service");

async function loadAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload?.sub) {
    return null;
  }

  const rows = await db.query(
    `SELECT p.player_id, p.username, p.email, p.narrator_persona, p.current_run, p.cycle_clears, p.current_body, p.memory_log, p.created_at, p.last_login_at,
            c.id AS character_id, c.character_name, c.race, c.class_name, c.level AS character_level, c.hp, c.max_hp, c.mana, c.max_mana, c.stamina, c.max_stamina,
            c.strength, c.agility, c.defense, c.thaumaturgy, c.resolve_stat, c.intelligence, c.luck, c.charisma, c.gold, c.soul_energy,
            c.dungeon AS character_dungeon, c.floor AS character_floor, c.status AS character_status
       FROM deep_saga_players p
       LEFT JOIN player_characters c ON c.player_id = p.player_id AND c.active_character = 1
      WHERE p.player_id = ?
      LIMIT 1`,
    [payload.sub]
  );

  if (!rows[0]) return null;

  return {
    token,
    player: serializePlayer(rows[0])
  };
}

async function requireAuth(req, res, next) {
  try {
    req.auth = await loadAuth(req);

    if (!req.auth) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    return next();
  } catch (error) {
    return res.status(503).json({ success: false, message: "Authentication lookup failed.", error: error.message });
  }
}

async function optionalAuth(req, res, next) {
  try {
    req.auth = await loadAuth(req);
    return next();
  } catch (error) {
    return res.status(503).json({ success: false, message: "Authentication lookup failed.", error: error.message });
  }
}

module.exports = {
  optionalAuth,
  requireAuth
};
