const express = require('express')
const { completeRun, continueGame, killCharacter, listSaves, listSkills, loadState, startGame } = require('../modules/gameEngine/gameEngine.service')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

router.get('/', (req, res) => {
  res.json({ success: true, module: 'Game Engine', message: 'Database-backed game state service is running.' })
})

router.use(requireAuth)

router.get('/saves', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listSaves(req.auth.account.id) })
  } catch (error) {
    next(error)
  }
})

router.get('/skills', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listSkills() })
  } catch (error) {
    next(error)
  }
})

router.post('/start', async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await startGame(req.auth.account.id) })
  } catch (error) {
    next(error)
  }
})

router.get('/state/:storyCycleId', async (req, res) => {
  try {
    res.json({ success: true, data: await loadState(req.params.storyCycleId, req.auth.account.id) })
  } catch (error) {
    res.status(404).json({ success: false, message: error.message })
  }
})

router.post('/continue', async (req, res) => {
  try {
    const requestKey = req.get('idempotency-key') || req.body.requestKey
    res.json({ success: true, data: await continueGame({ ...req.body, requestKey }, req.auth.account.id) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/cycles/:storyCycleId/death', async (req, res) => {
  try {
    await loadState(req.params.storyCycleId, req.auth.account.id)
    const data = await killCharacter(Number(req.params.storyCycleId), req.body.deathScene || '')
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/cycles/:storyCycleId/complete', async (req, res) => {
  try {
    await loadState(req.params.storyCycleId, req.auth.account.id)
    const data = await completeRun(Number(req.params.storyCycleId), req.body.bossData || {})
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

module.exports = router
