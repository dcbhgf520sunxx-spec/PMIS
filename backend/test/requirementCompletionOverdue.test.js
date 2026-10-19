const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateOverdue, overdueSql } = require('../src/services/overdueRules')
const today = '2026-10-19'
const calculate = (requirementType, status, completion) => calculateOverdue('requirement', {
  date: '2026-10-01', status, requirementType, ...(completion === undefined ? {} : { completion }),
}, today)

test('需求逾期沿用各路径完成判定，通过及未通过结论均不再逾期', () => {
  for (const [type, statuses] of [[1, [2, 3]], [2, [12, 13]], [3, [21, 22]], [4, [33, 34]]]) {
    for (const status of statuses) assert.deepEqual(calculate(type, status), { isOverdue: null, overdueDays: 0 })
  }
  assert.equal(calculate(1, 36).isOverdue, null)
  assert.equal(calculate(4, 37).isOverdue, null)
})
test('尚未完成的暂停需求仍按最新计划日期逾期；结论后实施或暂停保持完成', () => {
  assert.equal(calculate(4, 35).isOverdue, 1)
  for (const type of [1, 2, 3]) {
    for (const status of [30, 31, 32, 35]) {
      assert.equal(calculate(type, status, true).isOverdue, null)
      assert.equal(calculate(type, status, false).isOverdue, 1)
      assert.equal(calculate(type, status, null).isOverdue, null)
    }
  }
})
test('重新评估后重新参与逾期，缺少日期不纳入', () => {
  for (const [type, status] of [[1, 0], [1, 1], [2, 10], [2, 11], [3, 20]]) assert.equal(calculate(type, status).isOverdue, 1)
  assert.equal(calculateOverdue('requirement', { date: null, status: 31, requirementType: 4 }, today).isOverdue, null)
})

test('真实 PostgreSQL：逾期 SQL 与完成率的结论、重评和缺证据判定一致', {
  skip: process.env.REQUIREMENT_COMPLETION_OVERDUE_DB_TEST !== '1' && process.env.RUN_DB_INTEGRATION !== '1',
}, async () => {
  const db = require('../src/db')
  const { evaluateCompletion } = require('../src/services/mcpCompletionAnalysisService')
  const client = await db.pool.connect()
  const fixtures = [
    [1, 1, 2, [], null], [2, 2, 12, [], null], [3, 3, 21, [], null],
    [4, 1, 31, [[1, 2], [2, 30], [30, 31]], null],
    [5, 2, 35, [[11, 12], [12, 30], [30, 35]], null],
    [6, 1, 35, [[1, 3], [3, 0], [0, 35]], 1],
    [7, 4, 35, [], 1], [8, 1, 31, [], null], [9, 3, 22, [], null],
    [10, 4, 33, [], null], [11, 1, 36, [], null], [12, 4, 37, [], null],
    [13, 1, 31, [[1, 2], [0, 31]], null],
  ]
  try {
    await client.query('BEGIN READ ONLY')
    for (const [id, type, status, steps, expected] of fixtures) {
      const logs = steps.map(([old, next], index) => ({ business_type: 'requirement', target_id: id, field_name: 'status',
        old_value: String(old), new_value: String(next), log_id: index + 1, operation_id: `op${index}`, user_id: 1,
        created_at: `2026-10-${String(index + 2).padStart(2, '0')}T12:00:00+08:00` }))
      const expression = overdueSql('requirement', { alias: 'r' }).fields.replaceAll('CURRENT_TIMESTAMP', "TIMESTAMPTZ '2026-10-19T12:00:00+08:00'")
      const result = await client.query(`WITH pms_op_log AS (SELECT * FROM jsonb_to_recordset($4::jsonb) AS l(
        id int, log_id int, target_id int, field_name text, old_value text, new_value text, operation_id text, user_id int, created_at timestamptz, module text))
        SELECT ${expression} FROM (SELECT $1::int id, $2::int requirement_type, $3::int status, '2026-10-01'::date expected_end_date) r`,
      [id, type, status, JSON.stringify(logs.map(log => ({ ...log, id: log.log_id, module: '需求' })))])
      assert.equal(result.rows[0].is_overdue, expected, `requirement ${id}`)
      const completed = evaluateCompletion({ records: [{ business_type: 'requirement', id, requirement_type: type, status,
        name: '需求', owner_id: 1, created_date: '2026-10-01', plan_date: '2026-10-01' }], logs,
      people: [{ id: 1, name: '测试' }], types: ['requirement'], period: { start_date: '2026-10-01', end_date: today }, today, cutoff: today })
      const detail = completed.details[0]
      const overdue = status === 37 || detail.completed !== false ? null : 1
      assert.equal(result.rows[0].is_overdue, overdue, `completion parity ${id}`)
      assert.equal(result.rows[0].overdue_pending, status !== 37 && detail.completed === null, `pending ${id}`)
    }
  } finally { await client.query('ROLLBACK'); client.release(); await db.pool.end() }
})
