const express = require('express')
const {ok,fail,failField} = require('../utils/response')
const {createOpenClientAdminService} = require('../services/openClientAdminService')
function createOpenClientAdminRouter(service = createOpenClientAdminService()) {
  const router = express.Router()
  // 使用网页 JWT 和接口管理菜单权限，不接受外部系统凭证。
  router.use((_req,res,next) => {res.setHeader('Cache-Control','no-store');next()})
  const handle = (fn) => async (req,res) => {
    try {ok(res,await fn(req))}
    catch (e) {
      if (e.code === '23505') return failField(res,'code','系统编码已存在')
      if (e.field) return failField(res,e.field,e.message,e.statusCode || 400)
      if (!e.statusCode) console.error('接入管理处理失败',e.code || e.name)
      return fail(res,e.statusCode || 500,e.statusCode || 500,e.statusCode ? e.message : '接入管理处理失败')
    }
  }
  router.get('/',handle(() => service.list()))
  router.post('/',handle((req) => service.save(null,req.body,req.user.id,req.ip)))
  router.get('/:id',handle((req) => service.get(req.params.id)))
  router.put('/:id',handle((req) => service.save(req.params.id,req.body,req.user.id,req.ip)))
  router.patch('/:id/status',handle((req) => {
    if (![0,1].includes(req.body?.enabled) || Object.keys(req.body || {}).length !== 1) throw Object.assign(new Error('状态不正确'),{statusCode:400})
    return service.action(req.params.id,req.body.enabled ? 'enable' : 'disable',req.user.id,req.ip)
  }))
  router.post('/:id/credential',handle((req) => service.action(req.params.id,'rotate',req.user.id,req.ip)))
  router.get('/:id/requests',handle((req) => service.history(req.params.id,req.query)))
  return router
}
module.exports = createOpenClientAdminRouter()
module.exports.createOpenClientAdminRouter = createOpenClientAdminRouter
