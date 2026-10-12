const router = require('express').Router();
const { ok, fail, failField } = require('../utils/response');
const { createModelConnectionService } = require('../services/modelConnectionService');
function createModelConnectionRouter(service = createModelConnectionService()) {
  const routes = require('express').Router();
  routes.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const handle = fn => async (req, res) => {
    try { return ok(res, await fn(req)); }
    catch (error) {
      if (error.field) return failField(res, error.field, error.message, error.statusCode || 400);
      return fail(res, error.statusCode || 500, error.statusCode || 500, error.statusCode ? error.message : '模型中心处理失败');
    }
  };
  routes.get('/', handle(() => service.list()));
  routes.post('/', handle(req => service.save(null, req.body, req.user.id, req.ip)));
  routes.get('/:id', handle(req => service.get(req.params.id)));
  routes.put('/:id', handle(req => service.save(req.params.id, req.body, req.user.id, req.ip)));
  routes.patch('/:id/status', handle(req => {
    if (![0, 1].includes(req.body?.enabled) || Object.keys(req.body || {}).length !== 1) throw Object.assign(new Error('状态不正确'), { statusCode: 400 });
    return service.action(req.params.id, req.body.enabled ? 'enable' : 'disable', req.user.id, req.ip);
  }));
  routes.post('/:id/default', handle(req => service.action(req.params.id, 'default', req.user.id, req.ip)));
  routes.post('/:id/test', handle(req => service.testConnection(req.params.id)));
  return routes;
}
router.use(createModelConnectionRouter());
module.exports = router;
module.exports.createModelConnectionRouter = createModelConnectionRouter;
