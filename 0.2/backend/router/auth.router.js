const express = require("express");
const { optionalAuth, requireAuth } = require("../middleware/auth");
const { createToken } = require("../utils/token");
const { listNarratorPersonas, loginPlayer, normalizePersona, registerPlayer, updatePlayerPersona, validateUsername } = require("../services/player.service");

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
    const player = await registerPlayer({ username, email, password });
    const token = createToken(player);

    return res.status(201).json({
      success: true,
      message: "Player reincarnated.",
      data: { player, token }
    });
  } catch (error) {
    const message = String(error.message || "").toLowerCase();
    const duplicate = message.includes("duplicate");
    const usernameDuplicate = duplicate && message.includes("username");

    return res.status(duplicate ? 409 : 500).json({
      success: false,
      message: duplicate ? (usernameDuplicate ? "That username is already registered." : "That email is already registered.") : "Registration failed.",
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
    const player = await loginPlayer({ identifier, password });

    if (!player) {
      return res.status(401).json({ success: false, message: "Username, email, or password is incorrect." });
    }

    const token = createToken(player);

    return res.json({
      success: true,
      message: "Player synchronized.",
      data: { player, token }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Login failed.", error: error.message });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, data: { player: req.auth.player } });
});

router.get("/status", optionalAuth, (req, res) => {
  if (!req.auth) {
    return res.json({
      success: true,
      authenticated: false,
      message: "Your session has expired. Log in again to continue your story.",
      data: { player: null }
    });
  }

  return res.json({
    success: true,
    authenticated: true,
    data: { player: req.auth.player }
  });
});

router.get("/personas", async (req, res) => {
  try {
    const personas = await listNarratorPersonas();

    return res.json({
      success: true,
      data: { personas }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Personas could not be loaded.", error: error.message });
  }
});

router.patch("/persona", requireAuth, async (req, res) => {
  try {
    const narratorPersona = normalizePersona(req.body.persona);
    const player = await updatePlayerPersona(req.auth.player.playerId, narratorPersona);

    return res.json({
      success: true,
      message: "Narrator persona updated.",
      data: { player }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Persona update failed.", error: error.message });
  }
});

module.exports = router;
