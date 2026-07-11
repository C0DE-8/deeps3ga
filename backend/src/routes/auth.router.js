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

const router = express.Router()

router.get('/', (req, res) => res.json({ success: true, module: 'Authentication' }))

router.post('/register', async (req, res) => {
  const username = req.body.username?.trim()
  const email = req.body.email?.trim().toLowerCase()
  const password = req.body.password || ''
  if (username?.length < 3 || !email?.includes('@') || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Use a username of 3+ characters, a valid email, and a password of 8+ characters.' })
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

router.post('/login', async (req, res) => {
  const identifier = req.body.identifier?.trim()
  const password = req.body.password || ''
  try {
    const account = identifier ? await findAccountByIdentifier(identifier) : null
    if (!account || !(await verifyPassword(password, account.password_hash))) {
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
