const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { readOntologyModel } = require('../src/services/businessOntologyService')
const root = path.resolve(__dirname, '../../artifacts/sidm-ontology/standard')
test('业务本体展示读取标准模型，覆盖对象、关系、推导依据和确认口径', async () => {
  const model = await readOntologyModel(root)
  assert.equal(model.classes.length, 14)
  assert.equal(model.relations.length, 22)
  assert.ok(model.relations.every(r => r.meaning && r.quantity && r.boundary))
  assert.equal(model.relations.filter(r => r.inferred && r.proof.length).length, 2)
  assert.match(model.classes.find(c => c.id === 'MaintenanceContract').business.boundary, /录入即表示已付款/)
  assert.match(model.relations.find(r => r.id === 'sourceRequirement').quantity, /至多对应一个项目/)
  assert.equal(model.records, undefined)
})
test('本体状态说明与检查值集展示真实编码，需求前期状态完整且值集不重复', async () => {
  const model = await readOntologyModel(root)
  const requirement = model.classes.find(c => c.id === 'Requirement')
  assert.equal(requirement.business.earlyStates[0][1], '0 · 上会评估、1 · 需求上会、2 · 上会通过、3 · 过会未通过')
  assert.equal(requirement.business.earlyStates[1][1], '10 · 提报评估、11 · 需求审批、12 · 审批通过、13 · 审批未通过')
  assert.match(requirement.business.states, /34 · 已完成未使用/)
  assert.match(requirement.business.states, /36 · 已转项目/)
  for (const [type, value] of [['Requirement', '0 · 上会评估'], ['Project', '2 · 已完成'], ['KeyItem', '2 · 已完成'], ['Task', '0 · 待处理'], ['Bug', '2 · 已关闭'], ['WorkOrder', '5 · 被激活'], ['MaintenanceContract', 'active · 生效中']]) {
    const object = model.classes.find(c => c.id === type)
    assert.ok((object.business.states + object.business.earlyStates.flat().join(' ')).includes(value), `${type}的状态说明缺少编码`)
    const check = object.checks.find(c => c.label === '状态')
    assert.ok(check.text.includes(value), `${type}的状态检查缺少编码`)
    const values = check.text.split('允许值：')[1].split('、')
    assert.equal(values.length, new Set(values).size, `${type}的状态值集重复`)
  }
})
test('本体展示关闭编码与业务保持一致，关键事项不增加关闭状态', async () => {
  const model = await readOntologyModel(root)
  for (const [type, code] of [['Requirement', 37], ['Project', 4], ['Task', 4], ['WorkOrder', 3]]) {
    const object = model.classes.find(c => c.id === type)
    assert.ok(object.business.states.includes(`${code} · 已关闭`), type)
    assert.ok(object.checks.find(c => c.label === '状态').text.includes(`${code} · 已关闭`), type)
  }
  assert.ok(!model.classes.find(c => c.id === 'KeyItem').business.states.includes('已关闭'))
})
test('标准模型变化后拒绝展示旧定义，缺少生成文件不返回伪造模型', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidm-ontology-view-'))
  try {
    await assert.rejects(readOntologyModel(dir), /本体展示文件/)
    for (const name of ['sidm.ttl', 'shapes.ttl', 'model-view-data.cjs']) fs.copyFileSync(path.join(root, name), path.join(dir, name))
    fs.appendFileSync(path.join(dir, 'sidm.ttl'), '\n# changed\n')
    await assert.rejects(readOntologyModel(dir), /重新生成/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('业务本体菜单独立授权，位置在运维工单和数字孪生之间', () => {
  const repo = path.resolve(__dirname, '../..')
  const read = file => fs.readFileSync(path.join(repo, file), 'utf8')
  const sidebar = read('frontend/src/layouts/AdminLayout/index.tsx')
  assert.ok(sidebar.indexOf("key: '/work-orders'") < sidebar.indexOf("key: '/business-ontology'"))
  assert.ok(sidebar.indexOf("key: '/business-ontology'") < sidebar.indexOf("key: '/digital-twin'"))
  assert.match(read('backend/src/app.js'), /app.use\('\/api\/business-ontology', verifyToken, checkPermission\('\/business-ontology'\), businessOntologyRoutes\)/)
  assert.match(read('backend/db/init/001_schema.sql'), /'业务本体', 'business_ontology', 2, '\/business-ontology', 'ApartmentOutlined', 12,/)
  assert.match(read('backend/db/migrations/20261010_01_add_business_ontology_menu.sql'), /WHERE code = 'admin'/)
})
test('本体权限不由数字孪生或其他菜单授权代替', async () => {
  const db = require('../src/db')
  const original = db.prepare
  let granted = false
  db.prepare = sql => sql.startsWith('SELECT id FROM pms_menu')
    ? { get: async value => { assert.equal(value, '/business-ontology'); return { id: 29 } } }
    : { all: async (userId, menuId) => { assert.equal(userId, 42); assert.equal(menuId, 29); return granted ? [{ permitted: 1 }] : [] } }
  try {
    const { checkPermission } = require('../src/middleware/checkPermission')
    const check = checkPermission('/business-ontology')
    let status, body, passed = false
    const res = { status(code) { status = code; return this }, json(value) { body = value; return this } }
    await check({ user: { id: 42 } }, res, () => { passed = true })
    assert.equal(status, 403); assert.equal(body.message, '权限不足'); assert.equal(passed, false)
    granted = true
    await check({ user: { id: 42 } }, res, () => { passed = true })
    assert.equal(passed, true)
  } finally { db.prepare = original }
})

test('全部业务对象的属性名称和检查名称使用中文，不以英文标识回退', async () => {
  const model = await readOntologyModel(root)
  for (const object of model.classes) {
    for (const attribute of object.attributes) {
      assert.match(attribute.label, /[\u3400-\u9fff]/u, `${object.id}.${attribute.id}缺少中文名称`)
      assert.notEqual(attribute.label, attribute.id)
    }
    for (const check of object.checks) assert.match(check.label, /[\u3400-\u9fff]/u)
    assert.ok(object.checks.every(check => !check.text.includes('dateTime')))
  }
  const attributes = Object.fromEntries(model.classes.find(c => c.id === 'WorkOrder').attributes.map(a => [a.id, a.label]))
  assert.equal(attributes.activationReason, '激活原因')
  assert.equal(attributes.expectedResolveAt, '预计解决时间')
  assert.equal(attributes.pausedAt, '暂停时间')
  assert.equal(attributes.problemType, '问题类型')
})
