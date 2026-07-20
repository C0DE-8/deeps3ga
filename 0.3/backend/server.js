const express = require("express");
const { loadEnv } = require("./config/loadEnv");

loadEnv();

const db = require("./db");
const authRouter = require("./router/auth.router");
const storyRouter = require("./router/story.router");

const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});
app.use(express.json());

function getDbClient() {
  return db && (db.status ? db : db.db || db.default);
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "Deep S3GA API",
    message: "Deep Saga is a choice-based reincarnation story RPG.",
    auth: "/api/auth",
    health: "/health"
  });
});

app.use("/api/auth", authRouter);
app.use("/api/story", storyRouter);

app.get("/health", async (req, res) => {
  try {
    const dbClient = getDbClient();

    if (!dbClient || typeof dbClient.status !== "function") {
      throw new Error("DBMS Gateway connector is not loaded");
    }

    const status = await dbClient.status();
    res.json({ ok: true, gateway: status });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

if (require.main === module) {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

module.exports = app;
