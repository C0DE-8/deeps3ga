const { loadEnv } = require("./config/loadEnv");
const { connectProject } = require("./diamond-sql");

loadEnv();

const db = connectProject(process.env.SITE_ID, {
  apiKey: process.env.API_KEY,
  dbmsUrl: process.env.DBMS_URL,
  timeoutMs: process.env.DBMS_TIMEOUT_MS || 15000
});

module.exports = db;
