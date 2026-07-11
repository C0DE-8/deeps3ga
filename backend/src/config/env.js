const required = ['OPENAI_API_KEY']

function readEnv() {
  const env = {
    port: Number(process.env.PORT || 4000),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    dbMigrationsDir: process.env.DB_MIGRATIONS_DIR || './migrations',
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: Number(process.env.DB_PORT || 3306),
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'deep_saga',
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    aiTemperature: Number(process.env.AI_TEMPERATURE || 0.8),
  }

  env.missing = required.filter((key) => !process.env[key])
  return env
}

module.exports = { readEnv }
