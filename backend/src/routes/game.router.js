const express = require('express')
const { completeRun, continueGame, killCharacter, loadState } = require('../modules/gameEngine/gameEngine.service')

const router = express.Router()

router.get('/', (req, res) => {
  res.json({ success: true, module: 'Game Engine', message: 'Database-backed game state service is running.' })
})

router.get('/state/:storyCycleId', async (req, res) => {
  try {
    res.json({ success: true, data: await loadState(req.params.storyCycleId) })
  } catch (error) {
    res.status(404).json({ success: false, message: error.message })
  }
})

router.post('/continue', async (req, res) => {
  try {
    res.json({ success: true, data: await continueGame(req.body) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/cycles/:storyCycleId/death', async (req, res) => {
  try {
    const data = await killCharacter(Number(req.params.storyCycleId), req.body.deathScene || '')
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/cycles/:storyCycleId/complete', async (req, res) => {
  try {
    const data = await completeRun(Number(req.params.storyCycleId), req.body.bossData || {})
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

module.exports = router
