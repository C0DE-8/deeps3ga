const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createStoryScene } = require("../services/narrator.service");

const router = express.Router();

router.post("/opening", requireAuth, async (req, res) => {
  try {
    const scene = await createStoryScene(req.auth.player, req.body.playerAction);

    return res.json({ success: true, data: scene });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Narration failed.", error: error.message });
  }
});

module.exports = router;
