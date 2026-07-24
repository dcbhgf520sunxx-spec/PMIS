const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('任务负责人使用平级多负责人关联表并移除单负责人字段', () => {
  const schema = read('db/init/001_schema.sql')
  const migrationPath = path.join(root, 'db/migrations/20260724_03_add_task_owners.sql')
  const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''

  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_task_owner/)
  assert.match(schema, /PRIMARY KEY \(task_id, user_id\)/)
  assert.doesNotMatch(schema.match(/CREATE TABLE IF NOT EXISTS pms_task \([\s\S]*?\n\);/)?.[0] || '', /\bowner_id\b/)
  assert.match(migration, /INSERT INTO pms_task_owner[\s\S]*SELECT id, owner_id/)
  assert.match(migration, /ALTER TABLE pms_task DROP COLUMN owner_id/)
})

test('任务接口按任意负责人筛选并以 owner_ids 读写', () => {
  const controller = read('src/controllers/taskController.js')

  assert.match(controller, /pms_task_owner/)
  assert.match(controller, /EXISTS \(SELECT 1 FROM pms_task_owner/)
  assert.match(controller, /body\.owner_ids/)
  assert.match(controller, /owner_ids: '负责人'/)
  assert.doesNotMatch(controller, /body\.owner_id(?!s)/)
})

test('任务批量指派整体替换平级负责人集合', () => {
  const controller = read('src/controllers/taskController.js')

  assert.match(controller, /exports\.batchAssign/)
  assert.match(controller, /req\.body\.owner_ids/)
  assert.match(controller, /DELETE FROM pms_task_owner WHERE task_id=\?/)
  assert.match(controller, /批量指派/)
})

test('任务负责人联合主键写入兼容数据库 run 返回契约', () => {
  const controller = read('src/controllers/taskController.js')

  assert.match(controller, /INSERT INTO pms_task_owner\(task_id,user_id,sort_order\)VALUES\(\?,\?,\?\) RETURNING task_id AS id/)
})

test('任务历史继续兼容旧 owner_id 负责人记录', () => {
  const controller = read('src/controllers/taskController.js')

  assert.match(controller, /owner_id: '负责人'/)
  assert.match(controller, /loadLookup\('owner_id', 'SELECT id,real_name name FROM pms_user'\)/)
  assert.match(controller, /owner_id: owners/)
})

test('负责人查询不使用 PostgreSQL 保留字作为别名', () => {
  const controller = read('src/controllers/taskController.js')

  assert.doesNotMatch(controller, /JOIN pms_user user ON user\./)
  assert.match(controller, /JOIN pms_user owner_user ON owner_user\./)
})
