const crypto = require('crypto')
const { promisify } = require('util')

const scrypt = promisify(crypto.scrypt)

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${derived.toString('hex')}`
}

async function verifyPassword(password, encoded) {
  const [algorithm, salt, storedHex] = String(encoded || '').split(':')
  if (algorithm !== 'scrypt' || !salt || !storedHex) return false
  const derived = await scrypt(password, salt, 64)
  const stored = Buffer.from(storedHex, 'hex')
  return stored.length === derived.length && crypto.timingSafeEqual(stored, derived)
}

module.exports = { hashPassword, verifyPassword }
