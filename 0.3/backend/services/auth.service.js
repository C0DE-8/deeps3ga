const db = require("../db");
const { hashPassword, verifyPassword } = require("../utils/password");

function validateUsername(value) {
  const username = String(value || "").trim();
  return /^[A-Za-z0-9_]{3,24}$/.test(username) ? username : "";
}

function serializeUser(row) {
  if (!row) return null;
  return {
    userId: row.user_id || row.userId,
    user_id: row.user_id || row.userId,
    username: row.username,
    email: row.email,
    createdAt: row.created_at || row.createdAt,
    lastLoginAt: row.last_login_at || row.lastLoginAt
  };
}

async function registerUser({ username, email, password }) {
  const passwordHash = await hashPassword(password);
  await db.query(
    "INSERT INTO deep_saga_users (username, email, password_hash) VALUES (?, ?, ?)",
    [username, email, passwordHash]
  );

  const rows = await db.query("SELECT * FROM deep_saga_users WHERE username = ? LIMIT 1", [username]);
  return serializeUser(rows[0]);
}

async function loginUser({ identifier, password }) {
  const normalized = String(identifier || "").trim();
  const rows = await db.query(
    "SELECT * FROM deep_saga_users WHERE username = ? OR email = ? LIMIT 1",
    [normalized, normalized.toLowerCase()]
  );
  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return null;
  }

  await db.query("UPDATE deep_saga_users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?", [user.user_id]);
  return serializeUser(user);
}

async function getUserById(userId) {
  const rows = await db.query("SELECT * FROM deep_saga_users WHERE user_id = ? LIMIT 1", [userId]);
  return serializeUser(rows[0]);
}

module.exports = {
  getUserById,
  loginUser,
  registerUser,
  serializeUser,
  validateUsername
};
