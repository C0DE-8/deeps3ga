const express = require("express");
const db = require("./db");
const authRouter = require("./router/auth.router");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, message: "Deep S3GA API is running" });
});

app.use("/api/auth", authRouter);

app.get("/health", async (req, res) => {
  try {
    const status = await db.status();
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
