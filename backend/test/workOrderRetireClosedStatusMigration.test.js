const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const test = require('node:test')

test('历史已关闭工单迁为已解决并保留关闭时间', () => {
  const path = 'db/migrations/20260727_03_retire_work_order_closed_status.sql'
  const sql = existsSync(path) ? readFileSync(path, 'utf8') : ''

  assert.match(sql, /UPDATE\s+pms_work_order[\s\S]*SET\s+status\s*=\s*2[\s\S]*WHERE\s+status\s*=\s*3/i)
  assert.doesNotMatch(sql, /close_date\s*=/i)
})
