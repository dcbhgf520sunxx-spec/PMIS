const test = require('node:test')
const assert = require('node:assert/strict')
const db = require('../src/db')
const controller = require('../src/controllers/taskController')

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

for (const [name, old, body] of [
  ['关闭', { status: 1 }, { status: 4, close_date: '2026-10-13', close_reason: '停止工作' }],
  ['关闭后恢复', { status: 4, close_date: '2026-10-13', close_reason: '停止工作' }, { status: 1 }],
]) {
  test(`任务${name}不产生未变化的暂停原因日志`, async (t) => {
    const oldRow = { id: 1, name: '任务', parent_task_id: null, expected_end_date: '2026-10-01', actual_end_date: null, suspend_date: null, suspend_reason: null, close_date: null, close_reason: null, is_overdue: 1, ...old }
    let changes
    t.mock.method(db, 'prepare', () => ({ get: async () => oldRow, run: async () => ({ changes: 1 }) }))
    t.mock.method(db, 'writeLogs', async (_user, _action, _module, _id, fields) => { changes = fields })
    const res = response()
    await controller.toggleStatus({ params: { id: 1 }, body, user: { id: 1 }, ip: '127.0.0.1' }, res)
    assert.equal(res.statusCode, 200)
    assert.ok(!changes.some(change => change.field === 'suspend_reason'))
    assert.ok(changes.some(change => change.field === 'close_reason'))
    assert.ok(!JSON.stringify(changes).includes('"oldVal":"close_date"'))
  })
}

test('任务真实暂停原因变化记录业务值', async (t) => {
  const old = { id: 1, name: '任务', status: 3, parent_task_id: null, expected_end_date: '2026-10-01', actual_end_date: null, suspend_date: '2026-10-13', suspend_reason: '等待资源', close_date: null, close_reason: null }
  let changes
  t.mock.method(db, 'prepare', () => ({ get: async () => old, run: async () => ({ changes: 1 }) }))
  t.mock.method(db, 'writeLogs', async (_user, _action, _module, _id, fields) => { changes = fields })
  await controller.toggleStatus({ params: { id: 1 }, body: { status: 1 }, user: { id: 1 } }, response())
  assert.deepEqual(changes.find(change => change.field === 'suspend_reason'), { field: 'suspend_reason', oldVal: '等待资源', newVal: null })
})

test('历史隐藏确定误写的状态日志，真实原因及编辑记录仍展示且原始记录保留', async (t) => {
  const base = { action: '状态变更', operation_id: 'op1', operator: '验收', created_at: '2026-10-13 13:13:01+08' }
  const logs = [
    { ...base, id: 1, field_name: 'status', old_value: '1', new_value: '4' },
    { ...base, id: 2, field_name: 'suspend_reason', old_value: 'close_date', new_value: 'close_reason' },
    { ...base, id: 3, field_name: 'close_reason', old_value: null, new_value: '停止工作' },
    { ...base, operation_id: 'op2', id: 4, field_name: 'suspend_reason', old_value: '等待资源', new_value: null },
    { ...base, action: '编辑', operation_id: 'op3', id: 5, field_name: 'suspend_reason', old_value: 'close_date', new_value: 'close_reason' },
  ]
  t.mock.method(db, 'prepare', () => ({ all: async () => logs }))
  const res = response()
  await controller.history({ params: { id: 1 } }, res)
  assert.equal(res.statusCode, 200)
  const status = res.body.data.find(group => group.id === 1)
  assert.ok(!status.changes.some(change => change.field_name === '暂停原因'))
  assert.ok(JSON.stringify(res.body.data).includes('等待资源'))
  assert.ok(res.body.data.some(group => group.action === '编辑' && JSON.stringify(group.changes).includes('close_date')))
  assert.equal(logs.length, 5)
})
