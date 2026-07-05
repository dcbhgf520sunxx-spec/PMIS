const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/messageController')

router.get('/', ctrl.list)
router.put('/read-all', ctrl.markAllRead)
router.put('/:id/read', ctrl.markRead)

module.exports = router
