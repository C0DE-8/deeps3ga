const express = require('express')
const helmet = require('helmet')
const { loadEnvFile } = require('./config/loadEnv')
const { readEnv } = require('./config/env')
const { getDatabaseInfo } = require('./db/connection')
const routes = require('./routes')

loadEnvFile()

const env = readEnv()
const app = express()

app.use(helmet())
app.use(express.json())

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', env.frontendOrigin)
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

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    ok: true,
    missingEnv: env.missing,
    db: getDatabaseInfo(),
  })
})

app.use('/api', routes)

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  })
})

app.listen(env.port, () => {
  console.log(`Deep Saga server running on http://localhost:${env.port}`)
})
