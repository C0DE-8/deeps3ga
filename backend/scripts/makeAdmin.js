const { loadEnvFile } = require('../src/config/loadEnv')
const { query, getPool } = require('../src/db/connection')

loadEnvFile()

async function makeAdmin() {
  const identifier = process.argv[2]?.trim()
  if (!identifier) throw new Error('Usage: npm run make-admin -- username-or-email')
  const result = await query("UPDATE accounts SET role = 'admin' WHERE username = ? OR email = ?", [identifier, identifier])
  if (!result.affectedRows) throw new Error('No matching account was found. Register the account first.')
  console.log(`Administrator access granted to ${identifier}.`)
}

makeAdmin().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => getPool().end())
