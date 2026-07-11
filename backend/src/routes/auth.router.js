const express = require('express')
const { createAccount } = require('../db/repositories/account.repository')

const router = express.Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    module: 'Authentication',
    message: 'Authentication service is running.',
  })
})

router.post('/register', async (req, res) => {
  const username = req.body.username?.trim()

  if (!username) {
    res.status(400).json({
      success: false,
      message: 'username is required',
    })
    return
  }

  try {
    const account = await createAccount({ username, passwordHash: req.body.passwordHash })
    res.status(201).json({
      success: true,
      message: 'Register endpoint is ready.',
      data: account,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'account create failed',
      detail: error.message,
    })
  }
})

router.post('/login', (req, res) => {
  res.json({
    success: true,
    message: 'Login endpoint is ready.',
  })
})

module.exports = router
