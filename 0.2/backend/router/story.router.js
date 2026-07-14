const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createStoryScene, loadStoryHistory } = require("../services/narrator.service");
const { getPlayerSheet } = require("../services/player.service");

const router = express.Router();

router.post("/opening", requireAuth, async (req, res) => {
  try {
    const scene = await createStoryScene(req.auth.player, req.body.playerAction, req.body.recentMessages);

    return res.json({ success: true, data: scene });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Narration failed.", error: error.message });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const messages = await loadStoryHistory(req.auth.player, Number(req.query.limit || 80));

    return res.json({ success: true, data: { messages } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Story history failed.", error: error.message });
  }
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const sheet = await getPlayerSheet(req.auth.player.playerId);

    if (!sheet) {
      return res.status(404).json({ success: false, message: "Player sheet not found." });
    }

    return res.json({ success: true, data: sheet });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Player sheet failed.", error: error.message });
  }
});

module.exports = router;
