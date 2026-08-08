const express = require("express");
const { optionalAuth, requireAuth } = require("../middleware/auth");
const { createToken } = require("../utils/token");
const { loginUser, registerUser, validateUsername } = require("../services/auth.service");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ ok: true, message: "Auth is running" });
});

router.post("/register", async (req, res) => {
  const username = validateUsername(req.body.username);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!username) {
    return res.status(400).json({ success: false, message: "Username must be 3 to 24 characters using letters, numbers, or underscores." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ success: false, message: "Password must be 8 to 200 characters." });
  }

  try {
    const user = await registerUser({ username, email, password });
    return res.status(201).json({
      success: true,
      message: "Account created.",
      data: { player: user, user, token: createToken(user) }
    });
  } catch (error) {
    const duplicate = String(error.message || "").toLowerCase().includes("duplicate");
    return res.status(duplicate ? 409 : 500).json({
      success: false,
      message: duplicate ? "That username or email is already registered." : "Registration failed.",
      error: duplicate ? undefined : error.message
    });
  }
});

router.post("/login", async (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  const password = String(req.body.password || "");

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: "Username or email and password are required." });
  }

  try {
    const user = await loginUser({ identifier, password });
    if (!user) {
      return res.status(401).json({ success: false, message: "Username, email, or password is incorrect." });
    }
    return res.json({
      success: true,
      message: "Session restored.",
      data: { player: user, user, token: createToken(user) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Login failed.", error: error.message });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, data: { player: req.auth.user, user: req.auth.user } });
});

router.get("/status", optionalAuth, (req, res) => {
  if (!req.auth) {
    return res.json({
      success: true,
      authenticated: false,
      message: "Your session has expired. Log in again to continue your story.",
      data: { player: null, user: null }
    });
  }

  return res.json({
    success: true,
    authenticated: true,
    data: { player: req.auth.user, user: req.auth.user }
  });
});

module.exports = router;
