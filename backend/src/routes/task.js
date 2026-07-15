const router = require('express').Router()
const controller = require('../controllers/taskController')

router.get('/', controller.list)
router.get('/neighbors', controller.neighbors)
router.get('/project-options', controller.projectOptions)
router.get('/requirement-options', controller.requirementOptions)
router.get('/check-name', controller.checkName)
router.put('/batch-assign', controller.batchAssign)
router.get('/:id/subtasks', controller.listSubtasks)
router.post('/:id/subtasks', controller.createSubtask)
router.get('/:id/history', controller.history)
router.get('/:id', controller.getById)
router.post('/', controller.create)
router.put('/:id', controller.update)
router.put('/:id/status', controller.toggleStatus)
router.delete('/:id', controller.remove)

module.exports = router
