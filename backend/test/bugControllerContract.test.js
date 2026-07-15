const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', 'src')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('BUG 接口独立授权并提供完整路由', () => {
  const app = read('app.js')
  const routes = read('routes/bug.js')
  assert.match(app, /\/api\/bugs/)
  assert.match(app, /checkPermission\('\/bugs'\)/)
  for (const action of ['neighbors', 'project-options', 'requirement-options', 'check-title', 'batch-assign', 'history', 'status']) assert.match(routes, new RegExp(action))
})

test('BUG 写接口使用登录身份和字段级错误', () => {
  const source = read('controllers/bugController.js')
  assert.match(source, /req\.user\.id/)
  assert.doesNotMatch(source, /req\.body\.creator_id|req\.body\.updater_id/)
  assert.match(source, /failField/)
  assert.match(source, /writeLogs/)
})

test('BUG 列表和上下条共用筛选排序且返回视图计数', () => {
  const source = read('controllers/bugController.js')
  assert.match(source, /function getBugSortConfig/)
  assert.match(source, /exports\.neighbors[\s\S]*getBugSortConfig/)
  assert.match(source, /viewCounts/)
  assert.match(source, /sourceName/)
  assert.match(source, /bugTypeName/)
})

test('BUG 保存校验真实关联和两类基础档案', () => {
  const source = read('controllers/bugController.js')
  assert.match(source, /项目不存在或已删除/)
  assert.match(source, /需求不存在或已删除/)
  assert.match(source, /指派人不存在或已停用/)
  assert.match(source, /Bug类型不存在或已停用/)
  assert.match(source, /Bug解决方案不存在或已停用/)
})

test('BUG 变更历史统一转换中文字段和业务值', () => {
  const source = read('controllers/bugController.js')
  assert.match(source, /formatHistoryChanges/)
  assert.match(source, /fieldLabels:\s*HISTORY_FIELD_LABELS/)
  assert.match(source, /Bug标题/)
  assert.match(source, /修复时间/)
  assert.match(source, /关闭时间/)
  assert.match(source, /activation_reason:\s*'激活原因'/)
  assert.ok(source.indexOf("'status', 'activation_reason'") >= 0)
})

test('BUG 状态接口持久化并记录激活原因', () => {
  const source = read('controllers/bugController.js')
  assert.match(source, /activation_reason/)
  assert.match(source, /next\.activationReason/)
  assert.match(source, /addChange\('activation_reason'/)
})
