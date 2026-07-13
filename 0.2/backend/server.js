const express = require("express");
const db = require("./db");
const authRouter = require("./router/auth.router");

const app = express();
app.use(express.json());

function getDbClient() {
  return db && (db.status ? db : db.db || db.default);
}

app.get("/", (req, res) => {
  res.json({ ok: true, message: "Deep S3GA API is running" });
});

app.use("/api/auth", authRouter);

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
