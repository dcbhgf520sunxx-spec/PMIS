const router = require('express').Router();
const ctrl = require('../controllers/digitalTwinController');
router.get('/products', ctrl.products);
router.get('/personal', ctrl.personal);
router.post('/personal/summary', ctrl.personalSummary);
router.post('/:id/summary', ctrl.aiSummary);
router.get('/:id', ctrl.snapshot);
module.exports = router;
