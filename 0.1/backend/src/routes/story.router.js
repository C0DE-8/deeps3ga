const express = require('express')
const { continueGame } = require('../modules/gameEngine/gameEngine.service')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    module: 'Story',
    message: 'Story service is running.',
  })
})

router.post('/continue', requireAuth, async (req, res) => {
  try {
    const requestKey = req.get('idempotency-key') || req.body.requestKey
    const scene = await continueGame({ ...req.body, requestKey }, req.auth.account.id)
    res.json({
      success: true,
      data: scene,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

module.exports = router
