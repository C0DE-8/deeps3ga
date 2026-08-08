const { getUserById } = require("../services/auth.service");
const { verifyToken } = require("../utils/token");

async function loadAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload?.sub) return null;

  const user = await getUserById(payload.sub);
  if (!user) return null;

  return { token, user, player: user };
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
