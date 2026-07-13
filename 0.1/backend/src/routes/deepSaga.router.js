const express = require('express')
const { getFlow, getWorldBible } = require('../modules/deepSaga/deepSaga.service')

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

router.get('/world', (req, res) => {
  res.json(getWorldBible())
})

module.exports = router
