const express = require('express')
const crypto = require('crypto')
const helmet = require('helmet')
const { loadEnvFile } = require('./config/loadEnv')
const { readEnv } = require('./config/env')
const { getDatabaseInfo } = require('./db/connection')
const { query } = require('./db/connection')
const routes = require('./routes')
const { rateLimit } = require('./middleware/rateLimit')

loadEnvFile()

const env = readEnv()
const app = express()
if (env.trustProxy) app.set('trust proxy', 1)

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(express.json({ limit: env.requestBodyLimit }))
app.use(rateLimit({ windowMs: 60_000, limit: 120 }))
app.use((req, res, next) => {
  const startedAt = Date.now()
  req.requestId = req.get('x-request-id')?.slice(0, 100) || crypto.randomUUID()
  res.setHeader('X-Request-Id', req.requestId)
  res.on('finish', () => {
    console.log(JSON.stringify({ type: 'http', requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt }))
  })
  next()
})

app.use((req, res, next) => {
  const origin = req.get('origin')
  if (origin && env.frontendOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }

  next()
})

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Deep Saga API is running...',
  })
})

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({
      success: true,
      ok: true,
      missingEnv: env.nodeEnv === 'production' ? undefined : env.missing,
      db: env.nodeEnv === 'production' ? { driver: 'mysql2', connected: true } : { ...getDatabaseInfo(), connected: true },
    })
  } catch {
    res.status(503).json({ success: false, ok: false, db: { driver: 'mysql2', connected: false } })
  }
})

app.use('/api', routes)

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  console.error(JSON.stringify({ type: 'error', requestId: req.requestId, message: error.message, stack: env.nodeEnv === 'production' ? undefined : error.stack }))
  const status = error.type === 'entity.too.large' ? 413 : Number(error.status || 500)
  res.status(status).json({ success: false, message: status === 413 ? 'Request body is too large.' : 'The Deep Saga service encountered an error.' })
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  })
})

app.listen(env.port, () => {
  console.log(`Deep Saga server running on http://localhost:${env.port}`)
})
