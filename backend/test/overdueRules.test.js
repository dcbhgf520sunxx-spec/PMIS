const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateOverdue, overdueSql } = require('../src/services/overdueRules')
test('统一逾期按上海自然日计算，支持终态、父项目暂停及时间戳', () => {
  for (const type of ['project','requirement','task','work_order','stage_plan']) {
    assert.deepEqual(calculateOverdue(type,{date:'2026-09-20',status:1},'2026-09-21'),{isOverdue:1,overdueDays:1})
    assert.equal(calculateOverdue(type,{date:'2026-09-21',status:1},'2026-09-21').isOverdue,0)
    assert.equal(calculateOverdue(type,{date:null,status:1},'2026-09-21').overdueDays,0)
  }
  assert.equal(calculateOverdue('work_order',{date:'2026-09-19',status:4},'2026-09-21').isOverdue,0)
  assert.equal(calculateOverdue('work_order',{date:'2026-09-20T20:00:00Z',status:1},'2026-09-21').isOverdue,0)
  assert.equal(calculateOverdue('requirement',{date:'2026-09-19',status:35},'2026-09-21').isOverdue,null)
  assert.equal(calculateOverdue('stage_plan',{date:'2026-09-19',status:1,parentStatus:3},'2026-09-21').isOverdue,0)
})
test('SQL只允许服务端字段名，不允许注入任意表达式',()=>{
  assert.throws(()=>overdueSql('task',{alias:'t; DROP TABLE x'}))
})

test('同一套规则在SQL和对象计算中一致，包括凌晨、月末及暂停', {
  skip: process.env.OVERDUE_DB_TEST !== '1' && process.env.RUN_DB_INTEGRATION !== '1',
}, async () => {
  const db = require('../src/db')
  const client = await db.pool.connect()
  const cases = [
    ['project', 1, '2026-09-20', 1, 1], ['project', 3, '2026-09-20', 0, 0],
    ['requirement', 31, '2026-09-20', 1, 1], ['requirement', 33, '2026-09-20', null, 0],
    ['requirement', 3, '2026-09-20', null, 0], ['requirement', 13, '2026-09-20', null, 0],
    ['requirement', 22, '2026-09-20', null, 0], ['requirement', 34, '2026-09-20', null, 0],
    ['requirement', 35, '2026-09-20', null, 0],
    ['task', 1, '2026-09-20', 1, 1], ['task', 2, '2026-09-20', 0, 0],
    ['work_order', 4, '2026-09-20', 0, 0], ['work_order', 5, '2026-09-20', 1, 1],
    ['work_order', 1, '2026-09-20T20:00:00Z', 0, 0],
    ['stage_plan', 1, '2026-09-20', 1, 1], ['stage_plan', 1, '2026-09-20', 0, 0, 3],
  ]
  for (const type of ['project','requirement','task','work_order','stage_plan']) {
    cases.push([type,1,null,0,0], [type,1,'2026-09-21',0,0], [type,1,'2026-09-22',0,0], [type,1,'2026-08-31',1,21])
  }
  try {
    await client.query('BEGIN READ ONLY')
    await client.query("SET LOCAL TIME ZONE 'UTC'")
    for (const [type,status,date,flag,days,parentStatus=1] of cases) {
      const expression = overdueSql(type, {alias:'r',parentAlias:'p'})
      const fields = expression.fields.replaceAll('CURRENT_TIMESTAMP', "TIMESTAMPTZ '2026-09-20T16:01:00Z'")
      const result = await client.query(`SELECT ${fields} FROM
        (SELECT $1::int status, $2::date expected_end_date, $2::date current_due_date,
          $3::timestamptz expected_resolve_date) r CROSS JOIN (SELECT $4::int status) p`,
      [status, date?.slice(0,10) || null, date && date.length === 10 ? `${date}T00:00:00+08:00` : date, parentStatus])
      assert.deepEqual(result.rows[0], {is_overdue:flag, overdue_days:days}, `${type}/${status}/${date}/${parentStatus}`)
      assert.deepEqual(calculateOverdue(type,{status,date,parentStatus},'2026-09-21'),{isOverdue:flag,overdueDays:days})
    }
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await db.pool.end()
  }
})
