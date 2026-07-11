const express = require('express')

const router = express.Router()

router.use('/auth', require('./auth.router'))
router.use('/souls', require('./soul.router'))
router.use('/story', require('./story.router'))
router.use('/deep-saga', require('./deepSaga.router'))
router.use('/game', require('./game.router'))

module.exports = router
