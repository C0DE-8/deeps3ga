const required = ['OPENAI_API_KEY']

function readEnv() {
  const env = {
    port: Number(process.env.PORT || 4000),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    frontendOrigins: (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean),
    trustProxy: process.env.TRUST_PROXY === 'true',
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '32kb',
    dbMigrationsDir: process.env.DB_MIGRATIONS_DIR || './migrations',
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: Number(process.env.DB_PORT || 3306),
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'deep_saga',
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    aiTemperature: Number(process.env.AI_TEMPERATURE || 0.8),
    sessionDays: Math.max(1, Number(process.env.SESSION_DAYS || 30)),
  }

  env.missing = required.filter((key) => !process.env[key])
  return env
}

module.exports = { readEnv }
