const fs = require('fs/promises')
const path = require('path')
const mysql = require('mysql2/promise')
const { loadEnvFile } = require('../src/config/loadEnv')
const { readEnv } = require('../src/config/env')

loadEnvFile()

async function migrate() {
  const env = readEnv()
  const connection = await mysql.createConnection({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    multipleStatements: true,
  })

  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    const directory = path.resolve(process.cwd(), env.dbMigrationsDir)
    const filenames = (await fs.readdir(directory)).filter((name) => name.endsWith('.sql')).sort()

    for (const filename of filenames) {
      const [applied] = await connection.execute('SELECT filename FROM schema_migrations WHERE filename = ?', [filename])
      if (applied.length) continue
      const sql = await fs.readFile(path.join(directory, filename), 'utf8')
      const statements = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)

      for (const statement of statements) {
        try {
          await connection.query(statement)
        } catch (error) {
          const recoverable = new Set([
            'ER_TABLE_EXISTS_ERROR',
            'ER_DUP_FIELDNAME',
            'ER_DUP_KEYNAME',
            'ER_FK_DUP_NAME',
            'ER_DUP_ENTRY',
          ])
          if (!recoverable.has(error.code)) throw error
        }
      }
      await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename])
      console.log(`Applied ${filename}`)
    }
  } finally {
    await connection.end()
  }
}

migrate().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
