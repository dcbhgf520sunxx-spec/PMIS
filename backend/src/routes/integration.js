const express = require('express')
const controller = require('../controllers/integrationController')

const router = express.Router()
router.get('/', controller.list)
router.put('/:id', controller.update)
router.patch('/:id/status', controller.changeStatus)
router.post('/:id/test', controller.test)
router.post('/:id/sync', controller.sync)
router.get('/:id/executions', controller.executions)
router.get('/:id/executions/:executionId/records', controller.records)

module.exports = router
