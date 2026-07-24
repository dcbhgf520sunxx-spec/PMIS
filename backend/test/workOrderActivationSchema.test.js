const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const test = require('node:test')

const read = (file) => readFileSync(file, 'utf8')

test('工单激活原因同步到初始化结构和增量迁移', () => {
  const migrationPath = 'db/migrations/20260724_01_add_work_order_activation.sql'
  assert.equal(existsSync(migrationPath), true)
  const schema = read('db/init/001_schema.sql')
  const migration = read(migrationPath)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_work_order[\s\S]*activation_reason TEXT/)
  assert.match(migration, /ALTER TABLE pms_work_order[\s\S]*ADD COLUMN IF NOT EXISTS activation_reason TEXT/)
})

test('工单控制器读写激活原因并翻译被激活状态', () => {
  const controller = read('src/controllers/workOrderController.js')
  assert.match(controller, /activation_reason/)
  assert.match(controller, /resolveWorkOrderActivationReason\(status,[\s\S]*activation_reason[\s\S]*old\)/)
  assert.match(controller, /激活原因/)
  assert.match(controller, /\['5', '被激活'\]/)
})
