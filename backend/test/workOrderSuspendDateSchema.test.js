const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const test = require('node:test')

const read = (file) => readFileSync(file, 'utf8')

test('工单暂停时间同步到初始化结构和增量迁移', () => {
  assert.equal(existsSync('db/migrations/20260717_01_add_work_order_suspend_date.sql'), true)
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260717_01_add_work_order_suspend_date.sql')
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_work_order[\s\S]*suspend_date TIMESTAMPTZ/)
  assert.match(migration, /ALTER TABLE pms_work_order[\s\S]*ADD COLUMN IF NOT EXISTS suspend_date TIMESTAMPTZ/)
})

test('工单控制器读写并记录暂停时间', () => {
  const controller = read('src/controllers/workOrderController.js')
  assert.match(controller, /suspend_date/)
  assert.match(controller, /暂停时间/)
})
