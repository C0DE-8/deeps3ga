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
            c.dungeon AS character_dungeon, c.floor AS character_floor, c.status AS character_status,
            d.dungeon_number AS runtime_dungeon_number, d.canonical_label AS dungeon_label, d.ai_name AS dungeon_ai_name,
            f.floor_number AS runtime_floor_number, f.canonical_label AS floor_label, f.ai_name AS floor_ai_name, f.floor_role, f.is_boss_floor, f.is_final_boss_floor
       FROM deep_saga_players p
       LEFT JOIN player_characters c ON c.player_id = p.player_id AND c.active_character = 1
       LEFT JOIN dungeons d ON d.dungeon_number = COALESCE(c.dungeon, JSON_UNQUOTE(JSON_EXTRACT(p.current_body, '$.dungeon')), 1)
       LEFT JOIN dungeon_floors f ON f.dungeon_number = d.dungeon_number AND f.floor_number = COALESCE(c.floor, JSON_UNQUOTE(JSON_EXTRACT(p.current_body, '$.floor')), 1)
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
