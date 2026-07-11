const express = require('express')
const { continueScene } = require('../modules/deepSaga/deepSaga.service')

const router = express.Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    module: 'Story',
    message: 'Story service is running.',
  })
})

router.post('/continue', async (req, res) => {
  try {
    const scene = await continueScene(req.body)
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
