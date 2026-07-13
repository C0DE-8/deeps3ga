const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createOpeningScene } = require("../services/narrator.service");

const router = express.Router();

router.post("/opening", requireAuth, async (req, res) => {
  try {
    const scene = await createOpeningScene(req.auth.player);

    return res.json({ success: true, data: scene });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Narration failed.", error: error.message });
  }
});

module.exports = router;
