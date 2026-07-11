const express = require('express')
const { getFlow } = require('../modules/deepSaga/deepSaga.service')

const router = express.Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    module: 'Deep Saga',
    message: 'Deep Saga service is running.',
  })
})

router.get('/flow', (req, res) => {
  res.json(getFlow())
})

module.exports = router
