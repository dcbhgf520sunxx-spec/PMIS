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
