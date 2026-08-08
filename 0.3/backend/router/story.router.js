const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getBookBySlug, listBooks } = require("../services/book.service");
const { createBookRun, getRunForUser, listRunsForUser, loadRunState } = require("../services/run.service");
const { resolvePlayerAction } = require("../services/turn-engine.service");

const router = express.Router();

function userId(req) {
  return req.auth.user.userId;
}

router.get("/books", requireAuth, async (req, res) => {
  try {
    const books = await listBooks();
    const runs = await listRunsForUser(userId(req));
    return res.json({ success: true, data: { books, runs } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Books could not be loaded.", error: error.message });
  }
});

router.get("/books/:slug", requireAuth, async (req, res) => {
  try {
    const book = await getBookBySlug(req.params.slug);
    if (!book) return res.status(404).json({ success: false, message: "Book not found." });
    const runs = (await listRunsForUser(userId(req))).filter((run) => run.book.slug === book.slug);
    return res.json({ success: true, data: { book, runs } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Book detail could not be loaded.", error: error.message });
  }
});

router.get("/runs", requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: { runs: await listRunsForUser(userId(req)) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Runs could not be loaded.", error: error.message });
  }
});

router.post("/runs", requireAuth, async (req, res) => {
  try {
    const slug = String(req.body.bookSlug || req.body.slug || "ant-world");
    const book = await getBookBySlug(slug);
    if (!book || book.status !== "active") return res.status(400).json({ success: false, message: "That book is not active in 0.3." });
    const run = await createBookRun(userId(req), slug);
    return res.status(201).json({ success: true, data: run });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Run could not be created.", error: error.message });
  }
});

router.get("/runs/:runId", requireAuth, async (req, res) => {
  try {
    const run = await getRunForUser(userId(req), req.params.runId);
    if (!run) return res.status(404).json({ success: false, message: "Run not found." });
    return res.json({ success: true, data: run });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Run could not be loaded.", error: error.message });
  }
});

router.get("/runs/:runId/journal", requireAuth, async (req, res) => {
  try {
    const state = await loadRunState(userId(req), req.params.runId);
    if (!state) return res.status(404).json({ success: false, message: "Run not found." });
    return res.json({
      success: true,
      data: {
        character: state.character,
        traits: state.traits,
        abilities: state.abilities,
        discoveries: state.discoveries,
        relationships: state.relationships,
        openThreads: state.threads,
        resources: state.resources,
        events: state.events,
        worldState: state.worldState.filter((entry) => entry.visibility === "player")
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Journal could not be loaded.", error: error.message });
  }
});

router.post("/runs/:runId/actions", requireAuth, async (req, res) => {
  const action = String(req.body.action || "").trim();
  const clientActionId = String(req.body.clientActionId || "").trim();

  if (!action || action.length > 2000) {
    return res.status(400).json({ success: false, message: "Action text is required and must be under 2000 characters." });
  }
  if (!clientActionId || clientActionId.length > 120) {
    return res.status(400).json({ success: false, message: "A valid clientActionId is required." });
  }

  try {
    const result = await resolvePlayerAction({
      userId: userId(req),
      runId: req.params.runId,
      action,
      clientActionId,
      expectedVersion: req.body.expectedVersion
    });
    return res.json({ success: true, duplicate: result.duplicate, data: result.response });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.status === 409 ? error.message : "Action could not be resolved safely.",
      error: error.status ? undefined : error.message
    });
  }
});

router.post("/runs/:runId/abandon", requireAuth, async (req, res) => {
  try {
    const run = await getRunForUser(userId(req), req.params.runId);
    if (!run) return res.status(404).json({ success: false, message: "Run not found." });
    await require("../db").query(
      "UPDATE deep_saga_runs SET status = 'abandoned', last_played_at = CURRENT_TIMESTAMP WHERE run_id = ? AND user_id = ? AND status = 'active'",
      [req.params.runId, userId(req)]
    );
    return res.json({ success: true, data: await getRunForUser(userId(req), req.params.runId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Run could not be abandoned.", error: error.message });
  }
});

router.get("/journey/:runId", requireAuth, async (req, res) => {
  try {
    const state = await loadRunState(userId(req), req.params.runId);
    if (!state) return res.status(404).json({ success: false, message: "Run not found." });
    return res.json({
      success: true,
      data: {
        run: state.run,
        book: state.book,
        character: state.character,
        messages: state.messages,
        discoveries: state.discoveries,
        facts: state.facts,
        traits: state.traits,
        abilities: state.abilities,
        relationships: state.relationships,
        resources: state.resources,
        events: state.events
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Journey could not be loaded.", error: error.message });
  }
});

module.exports = router;
