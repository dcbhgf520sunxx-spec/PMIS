const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

test('工单有效数据唯一索引同步到初始化结构和迁移', () => {
  const schema = readFileSync('db/init/001_schema.sql', 'utf8')
  const migration = readFileSync('db/migrations/20260712_add_work_order_problem_desc_unique.sql', 'utf8')

  for (const source of [schema, migration]) {
    assert.match(source, /uk_work_order_problem_desc_active/)
    assert.match(source, /md5\(problem_desc\)/)
    assert.match(source, /WHERE is_deleted = 0/)
  }
})
