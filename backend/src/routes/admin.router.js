const express = require('express')
const { getDataset, getOverview } = require('../db/repositories/admin.repository')
const { requireAdmin, requireAuth } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth, requireAdmin)

router.get('/overview', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getOverview() })
  } catch (error) {
    next(error)
  }
})

router.get('/data/:dataset', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getDataset(req.params.dataset, req.query.page, req.query.pageSize) })
  } catch (error) {
    if (error.message === 'Unknown admin dataset.') return res.status(404).json({ success: false, message: error.message })
    next(error)
  }
})

module.exports = router
