const { findSession } = require('../db/repositories/account.repository')

async function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' })

  try {
    const account = await findSession(token)
    if (!account) return res.status(401).json({ success: false, message: 'Session expired or invalid.' })
    req.auth = { account, token }
    next()
  } catch (error) {
    next(error)
  }
}

function requireAdmin(req, res, next) {
  if (req.auth?.account?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Administrator access required.' })
  }
  next()
}

module.exports = { requireAdmin, requireAuth }
