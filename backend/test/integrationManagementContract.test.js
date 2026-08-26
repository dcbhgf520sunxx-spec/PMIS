const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('接口状态只通过独立状态操作修改，并复用用户管理的启停确认交互', () => {
  const controller = read('src/controllers/integrationController.js')
  const routes = read('src/routes/integration.js')
  const page = read('../frontend/src/modules/integration/pages/IntegrationPage.tsx')

  assert.match(controller, /exports\.changeStatus/)
  assert.match(routes, /:\id\/status/)
  assert.match(page, /StatusConfirmAction/)
  assert.match(page, /entityName="接口"/)
  assert.match(page, /targetName=\{row\.name\}/)
  assert.doesNotMatch(page, /StatusChangeAction/)
  assert.doesNotMatch(page, /name="enabled"/)
})

test('接口编辑支持首次执行时间且测试连接提供独立超时与失败提示', () => {
  const page = read('../frontend/src/modules/integration/pages/IntegrationPage.tsx')
  const api = read('../frontend/src/api/integrationApi.ts')

  assert.match(page, /name="auto_start_at"/)
  assert.match(page, /showTime/)
  assert.match(page, /测试连接失败/)
  assert.match(api, /timeout:\s*35000/)
})

test('测试连接成功只提示连接成功，不展示返回数据条数', () => {
  const page = read('../frontend/src/modules/integration/pages/IntegrationPage.tsx')

  assert.match(page, /message\.success\('连接成功'\)/)
  assert.doesNotMatch(page, /连接成功，返回/)
})

test('接口列表展示序号并为自动执行规则保留完整悬停内容', () => {
  const page = read('../frontend/src/modules/integration/pages/IntegrationPage.tsx')

  assert.match(page, /title:\s*'序号',[\s\S]*width:\s*60,[\s\S]*configList\.renderIndex\(index\)/)
  assert.match(page, /title:\s*'接口名称',[\s\S]*dataIndex:\s*'name',[\s\S]*width:\s*260/)
  assert.match(page, /title:\s*'自动执行',[\s\S]*dataIndex:\s*'auto_start_at',[\s\S]*width:\s*320/)
  assert.match(page, /renderText:\s*\(_,[\s\S]*formatAutoExecution/)
  assert.match(page, /onCell:\s*\(row\)[\s\S]*title:\s*formatAutoExecution\(row\)/)
})

test('立即同步使用独立长超时，并在失败时向用户显示明确提示', () => {
  const page = read('../frontend/src/modules/integration/pages/IntegrationPage.tsx')
  const api = read('../frontend/src/api/integrationApi.ts')

  assert.match(api, /runIntegrationSync[\s\S]*timeout:\s*120000/)
  assert.match(page, /同步失败/)
  assert.match(page, /message\.error\(getErrorMessage\(error,\s*'同步失败'\)\)/)
})

test('执行历史明确区分自动执行和手动执行', () => {
  const controller = read('src/controllers/integrationController.js')
  const page = read('../frontend/src/modules/integration/pages/IntegrationPage.tsx')
  const api = read('../frontend/src/api/integrationApi.ts')

  assert.match(controller, /execution_key/)
  assert.match(controller, /trigger_type/)
  assert.match(page, /title:\s*'执行方式'/)
  assert.match(page, /自动执行/)
  assert.match(page, /手动执行/)
  assert.match(api, /trigger_type/)
})
