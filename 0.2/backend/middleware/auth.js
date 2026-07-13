const db = require("../db");
const { verifyToken } = require("../utils/token");
const { serializePlayer } = require("../services/player.service");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload?.sub) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const rows = await db.query(
      "SELECT player_id, email, current_run, cycle_clears, current_body, memory_log, created_at, last_login_at FROM deep_saga_players WHERE player_id = ? LIMIT 1",
      [payload.sub]
    );

    if (!rows[0]) {
      return res.status(401).json({ success: false, message: "Player record not found." });
    }

    req.auth = {
      token,
      player: serializePlayer(rows[0])
    };

    return next();
  } catch (error) {
    return res.status(503).json({ success: false, message: "Authentication lookup failed.", error: error.message });
  }
}

module.exports = {
  requireAuth
};
