const { query } = require('../connection')

async function createAccount({ username, passwordHash = null }) {
  const result = await query(
    'INSERT INTO accounts (username, password_hash) VALUES (?, ?)',
    [username, passwordHash],
  )

  return {
    id: result.insertId,
    username,
    passwordHashSet: Boolean(passwordHash),
    createdAt: new Date().toISOString(),
  }
}

module.exports = { createAccount }
