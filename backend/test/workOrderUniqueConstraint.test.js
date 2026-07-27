const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const test = require('node:test')

test('工单问题描述允许重复且旧唯一索引由迁移删除', () => {
  const schema = readFileSync('db/init/001_schema.sql', 'utf8')
  const migrationPath = 'db/migrations/20260727_01_drop_work_order_problem_desc_unique.sql'
  const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''

  assert.doesNotMatch(schema, /uk_work_order_problem_desc_active/)
  assert.match(migration, /SET LOCAL lock_timeout = '5s'/)
  assert.match(migration, /DROP INDEX IF EXISTS uk_work_order_problem_desc_active/)
})
