const assert = require('node:assert/strict')
const test = require('node:test')
const db = require('../src/db')
const controller = require('../src/controllers/projectStagePlanController')

test('阶段历史查询投影业务标识并保持项目和阶段动作隔离及已删除记录', async (t) => {
  const queries = []
  t.mock.method(db.pool, 'query', async (sql, params) => {
    queries.push({ sql, params })
    if (sql.includes('FROM pms_project WHERE')) return { rows: [{ id: '7', name: '项目一' }] }
    if (sql.includes('FROM pms_op_log l')) return { rows: [{
      id: '540', operation_id: null, action: '删除关键事项', target_id: '20', target_name: '启动会',
      field_name: 'is_deleted', old_value: '0', new_value: '1', created_at: '2026-09-08 10:00:00', operator: '孙鑫鑫',
    }] }
    if (sql.includes('FROM pms_project_plan_stage WHERE')) return { rows: [{ id: '2', name: '启动阶段' }] }
    if (sql.includes('FROM pms_project_plan_adjustment a')) return { rows: [] }
    throw new Error(`Unexpected SQL: ${sql}`)
  })
  const res = {
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }

  await controller.history({ params: { projectId: '7' } }, res)

  assert.equal(res.statusCode, 200)
  const historyQuery = queries.find(({ sql }) => sql.includes('FROM pms_op_log l'))
  assert.match(historyQuery.sql.split('FROM pms_op_log l')[0], /\bl\.target_id\b/, 'SQL 必须查询真实业务 ID，而不是依赖测试夹具补入')
  assert.deepEqual(historyQuery.params, [
    '新增阶段', '编辑阶段', '调整阶段顺序', '删除阶段', '套用阶段模板', '7',
    '新增阶段', '编辑阶段', '调整阶段顺序', '删除阶段', '套用阶段模板', '7',
  ])
  assert.match(historyQuery.sql, /l\.action IN\([^)]*\) AND EXISTS\([\s\S]*s\.id=l\.target_id AND s\.project_id=/)
  assert.match(historyQuery.sql, /l\.action NOT IN\([^)]*\) AND EXISTS\([\s\S]*i\.id=l\.target_id AND s\.project_id=/)
  assert.doesNotMatch(historyQuery.sql, /is_deleted\s*=\s*0/, '历史不能因阶段或事项软删除而消失')
  assert.deepEqual(res.payload.data, [{
    id: '540', target_type: 'stage_item', target_id: 20, project_id: 7,
    action: '删除关键事项 · 启动会', created_at: '2026-09-08 10:00:00', operator: '孙鑫鑫', changes: [],
  }])
})

test('阶段历史对不存在或已删除项目返回 404 且不查询项目历史', async (t) => {
  t.mock.method(db.pool, 'query', async (sql, params) => {
    assert.match(sql, /FROM pms_project WHERE id=\$1 AND is_deleted=0/)
    assert.deepEqual(params, ['404'])
    return { rows: [] }
  })
  const res = {
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }

  await controller.history({ params: { projectId: '404' } }, res)

  assert.equal(res.statusCode, 404)
  assert.equal(res.payload.data, null)
})
