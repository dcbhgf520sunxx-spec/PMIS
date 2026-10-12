const router = require('express').Router();
const ctrl = require('../controllers/digitalTwinController');
router.get('/products', ctrl.products);
router.get('/:id', ctrl.snapshot);
module.exports = router;
