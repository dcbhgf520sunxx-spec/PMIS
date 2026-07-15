const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const sql = fs.readFileSync(path.join(__dirname, '../db/migrations/20260713_seed_bug_mock_data.sql'), 'utf8')

test('BUG 模拟数据固定生成 60 条且可重复执行', () => {
  assert.match(sql, /generate_series\(1,\s*60\)/)
  assert.match(sql, /模拟BUG-20260713-/)
  assert.match(sql, /ON CONFLICT\s*\(title\)/i)
})

test('BUG 模拟数据覆盖项目需求、基础档案、状态和操作日志', () => {
  assert.match(sql, /pms_project/)
  assert.match(sql, /pms_requirement/)
  assert.match(sql, /bug_type/)
  assert.match(sql, /bug_resolution/)
  assert.match(sql, /INSERT INTO pms_op_log/)
  assert.match(sql, /'BUG'/)
  assert.match(sql, /'状态变更'/)
})
