const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/workOrderController')

router.get('/', ctrl.list)
router.get('/neighbors', ctrl.getNeighbors)
router.post('/refresh-overdue', ctrl.refreshOverdue)
router.put('/batch-assign', ctrl.batchAssign)
router.get('/:id', ctrl.getById)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.put('/:id/status', ctrl.toggleStatus)
router.delete('/:id', ctrl.remove)
router.get('/:id/history', ctrl.getHistory)

module.exports = router
