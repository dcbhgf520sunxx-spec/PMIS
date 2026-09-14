const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

const read = (file) => readFileSync(file, 'utf8')

test('四类单据的暂停原因同步到初始化结构和增量迁移', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260914_01_add_pause_reasons.sql')
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_project[\s\S]*suspend_reason VARCHAR\(200\)/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_requirement[\s\S]*pause_reason VARCHAR\(200\)/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_task[\s\S]*suspend_reason VARCHAR\(200\)/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_work_order[\s\S]*suspend_reason VARCHAR\(200\)/)
  for (const table of ['pms_project', 'pms_requirement', 'pms_task', 'pms_work_order']) {
    assert.match(migration, new RegExp(`ALTER TABLE ${table}[\\s\\S]*ADD COLUMN IF NOT EXISTS (?:pause|suspend)_reason VARCHAR\\(200\\)`))
  }
})

test('四类单据的状态接口都保存并记录暂停原因', () => {
  for (const file of ['projectController.js', 'requirementController.js', 'taskController.js', 'workOrderController.js']) {
    const controller = read(`src/controllers/${file}`)
    assert.match(controller, /(?:pause|suspend)_reason/)
    assert.match(controller, /暂停原因/)
  }
})
