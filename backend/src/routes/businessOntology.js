const router = require('express').Router()
const { readOntologyModel } = require('../services/businessOntologyService')
const { ok, fail } = require('../utils/response')
router.get('/', async (req, res, next) => {
  try { ok(res, await readOntologyModel()) }
  catch (error) {
    if (error.status) return fail(res, error.status, error.status, error.message)
    next(error)
  }
})
module.exports = router
