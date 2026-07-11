const express = require('express')
const { createSoul } = require('../db/repositories/soul.repository')

const router = express.Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    module: 'Souls',
    message: 'Soul service is running.',
  })
})

router.post('/', async (req, res) => {
  if (!req.body.accountId || !req.body.soulName) {
    res.status(400).json({
      success: false,
      message: 'accountId and soulName are required',
    })
    return
  }

  try {
    const soul = await createSoul({ accountId: req.body.accountId, soulName: req.body.soulName })
    res.status(201).json({
      success: true,
      message: 'Soul endpoint is ready.',
      data: soul,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'soul create failed',
      detail: error.message,
    })
  }
})

module.exports = router
