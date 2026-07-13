const express = require('express')
const {
  createAccount,
  createSession,
  findAccountByIdentifier,
  recordLogin,
  revokeSession,
} = require('../db/repositories/account.repository')
const { requireAuth } = require('../middleware/auth')
const { hashPassword, verifyPassword } = require('../utils/password')
const { rateLimit } = require('../middleware/rateLimit')

const router = express.Router()
const DUMMY_PASSWORD_HASH = `scrypt:00000000000000000000000000000000:${'00'.repeat(64)}`

router.get('/', (req, res) => res.json({ success: true, module: 'Authentication' }))

const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, key: (req) => `auth:${req.ip}` })

router.post('/register', authLimit, async (req, res) => {
  const username = req.body.username?.trim()
  const email = req.body.email?.trim().toLowerCase()
  const password = req.body.password || ''
  if (!/^[a-zA-Z0-9_-]{3,40}$/.test(username || '') || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 200) {
    return res.status(400).json({ success: false, message: 'Use a 3-40 character username, a valid email, and a password of 10+ characters.' })
  }

  try {
    const account = await createAccount({ username, email, passwordHash: await hashPassword(password) })
    const token = await createSession(account.id)
    res.status(201).json({ success: true, message: 'Soul record created.', data: { account, token } })
  } catch (error) {
    const duplicate = error.code === 'ER_DUP_ENTRY'
    res.status(duplicate ? 409 : 500).json({ success: false, message: duplicate ? 'That username or email is already registered.' : 'Account creation failed.' })
  }
})

router.post('/login', authLimit, async (req, res) => {
  const identifier = req.body.identifier?.trim()
  const password = req.body.password || ''
  try {
    const account = identifier ? await findAccountByIdentifier(identifier) : null
    const passwordValid = await verifyPassword(password, account?.password_hash || DUMMY_PASSWORD_HASH)
    if (!account || !passwordValid) {
      return res.status(401).json({ success: false, message: 'The soul identifier or secret key is incorrect.' })
    }
    const token = await createSession(account.id)
    await recordLogin(account.id)
    res.json({ success: true, message: 'Soul synchronized.', data: { account: { id: account.id, username: account.username, email: account.email, role: account.role }, token } })
  } catch {
    res.status(500).json({ success: false, message: 'Authentication failed.' })
  }
})

router.get('/me', requireAuth, (req, res) => res.json({ success: true, data: req.auth.account }))

router.post('/logout', requireAuth, async (req, res) => {
  await revokeSession(req.auth.token)
  res.json({ success: true, message: 'Session closed.' })
})

module.exports = router
