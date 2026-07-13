const crypto = require('crypto')
const { query, withTransaction } = require('../connection')

function publicAccount(account) {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    role: account.role,
    createdAt: account.created_at,
  }
}

async function createAccount({ username, email, passwordHash }) {
  return withTransaction(async (connection) => {
    const [result] = await connection.execute(
      'INSERT INTO accounts (username, email, password_hash, role) VALUES (?, ?, ?, \'player\')',
      [username, email, passwordHash],
    )
    const [rows] = await connection.execute('SELECT * FROM accounts WHERE id = ?', [result.insertId])
    return publicAccount(rows[0])
  })
}

async function findAccountByIdentifier(identifier) {
  const rows = await query('SELECT * FROM accounts WHERE username = ? OR email = ? LIMIT 1', [identifier, identifier])
  return rows[0] || null
}

async function createSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const sessionDays = Math.max(1, Math.min(90, Number(process.env.SESSION_DAYS || 30)))
  await query('DELETE FROM account_sessions WHERE account_id = ? AND (revoked_at IS NOT NULL OR expires_at <= CURRENT_TIMESTAMP)', [accountId])
  await query(
    `UPDATE account_sessions SET revoked_at = CURRENT_TIMESTAMP
      WHERE account_id = ? AND revoked_at IS NULL AND id NOT IN
        (SELECT id FROM (SELECT id FROM account_sessions WHERE account_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 4) recent)`,
    [accountId, accountId],
  )
  await query(
    'INSERT INTO account_sessions (account_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY))',
    [accountId, tokenHash, sessionDays],
  )
  return token
}

async function findSession(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const rows = await query(
    `SELECT a.id, a.username, a.email, a.role, a.created_at
       FROM account_sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP LIMIT 1`,
    [tokenHash],
  )
  return rows[0] ? publicAccount(rows[0]) : null
}

async function revokeSession(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await query('UPDATE account_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?', [tokenHash])
}

async function recordLogin(accountId) {
  await query('UPDATE accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [accountId])
}

module.exports = { createAccount, createSession, findAccountByIdentifier, findSession, publicAccount, recordLogin, revokeSession }
