const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getConfig,
  payloadHash,
  requestExternalRecords,
  saveRequirement,
  saveWorkOrder,
  testConnection,
  uniqueRequirementTitle,
} = require('../src/services/itopsSyncService')

test('i8 已完成需求保存时同步落库完成情况', async () => {
  const calls = []
  const logs = []
  const tx = {
    prepare(sql) {
      return {
        get: async () => null,
        run: async (...params) => {
          calls.push({ sql, params })
          return { lastInsertRowid: 101 }
        },
      }
    },
    writeLog: async (...params) => logs.push(params),
  }

  await saveRequirement(tx, {
    title: '来源需求', externalCode: 'I8-001', syncedSection: '<p>问题描述：来源需求</p>',
    priority: 1, status: 33, submitDate: '2026-08-24', expectedEndDate: '2026-08-25',
    actualEndDate: '2026-08-25', completionStatus: '已处理',
  }, { product_id: 75 }, { id: 88 }, null, 88)

  const insert = calls.find((call) => call.sql.includes('INSERT INTO pms_requirement'))
  assert.ok(insert)
  assert.match(insert.sql, /completion_status/)
  assert.equal(insert.params[4], 0)
  assert.ok(insert.params.includes('已处理'))
  assert.equal(logs.length, 1)
  assert.deepEqual(logs[0].slice(0, 5), [88, 'i8同步新增', '需求', 101, null])
})

test('i8 更新需求时保留 PMIS 已调整的优先级且不生成优先级变更历史', async () => {
  const writes = []
  const calls = []
  const tx = {
    prepare(sql) {
      return {
        get: async () => null,
        run: async (...params) => {
          calls.push({ sql, params })
          return { changes: 1 }
        },
      }
    },
    writeLogs: async (...params) => writes.push(params),
  }
  const syncedSection = '<p>问题描述：来源需求</p>'
  const description = `<!-- i8-sync:start -->\n${syncedSection}\n<!-- i8-sync:end -->`

  await saveRequirement(tx, {
    title: '来源需求', externalCode: 'I8-002', syncedSection,
    priority: 0, status: 31, submitDate: '2026-08-24', expectedEndDate: null,
    actualEndDate: null, completionStatus: null,
  }, { product_id: 75 }, { id: 88 }, {
    id: 102, title: '来源需求', description, requirement_type: 4, product_id: 75,
    owner_id: 88, priority: 2, status: 31, is_overdue: 0, submitter_name: 'i8',
    submitter_dept: 'i8', submit_date: '2026-08-24', expected_end_date: null,
    actual_end_date: null, completion_status: null,
  }, 99)

  const update = calls.find((call) => call.sql.includes('UPDATE pms_requirement'))
  assert.ok(update)
  assert.doesNotMatch(update.sql, /priority\s*=/)
  assert.equal(writes.length, 0)
})

test('i8 重复写入完全相同的需求时不生成空变更历史', async () => {
  let historyWrites = 0
  const tx = {
    prepare() {
      return {
        get: async () => null,
        run: async () => ({ changes: 1 }),
      }
    },
    writeLogs: async () => { historyWrites += 1 },
  }
  const syncedSection = '<p>问题描述：来源需求</p>'
  const description = `<!-- i8-sync:start -->\n${syncedSection}\n<!-- i8-sync:end -->`

  await saveRequirement(tx, {
    title: '来源需求', externalCode: 'I8-003', syncedSection,
    priority: 1, status: 31, submitDate: '2026-08-24', expectedEndDate: null,
    actualEndDate: null, completionStatus: null,
  }, { product_id: 75 }, { id: 88 }, {
    id: 103, title: '来源需求', description, requirement_type: 4, product_id: 75,
    owner_id: 88, priority: 1, status: 31, is_overdue: 0, submitter_name: 'i8',
    submitter_dept: 'i8', submit_date: '2026-08-24', expected_end_date: null,
    actual_end_date: null, completion_status: null,
  }, 99)

  assert.equal(historyWrites, 0)
})

test('i8 新增运维工单时写入同步来源历史', async () => {
  const logs = []
  const tx = {
    prepare(sql) {
      return {
        get: async () => sql.includes('FROM pms_archive') ? { id: 7 } : null,
        run: async () => ({ lastInsertRowid: 201 }),
      }
    },
    writeLog: async (...params) => logs.push(params),
  }

  await saveWorkOrder(tx, {
    externalCode: 'I8-WO-1', problemTypeName: '日常操作', problemDescription: '无法登录',
    syncedSection: '<p>问题描述：无法登录</p>', solution: null, priority: 1, status: 1,
    submitDate: '2026-08-24', expectedEndDate: null, actualEndDate: null,
  }, { product_id: 75 }, { id: 88 }, null, 99)

  assert.equal(logs.length, 1)
  assert.deepEqual(logs[0].slice(0, 5), [99, 'i8同步新增', '运维工单', 201, null])
  assert.equal(logs[0][8], '无法登录')
})

test('i8 新增需求和工单时保存来源提交人及提交组织', async () => {
  const calls = []
  const tx = {
    prepare(sql) {
      return {
        get: async () => sql.includes('FROM pms_archive') ? { id: 7 } : null,
        run: async (...params) => {
          calls.push({ sql, params })
          return { lastInsertRowid: calls.length + 300 }
        },
      }
    },
    writeLog: async () => {},
  }
  const submitter = { submitterName: '徐波', submitterDept: '建筑工程公司项目部' }

  await saveRequirement(tx, {
    title: '来源需求', externalCode: 'I8-SUBMITTER-REQ', syncedSection: '<p>来源需求</p>',
    priority: 0, status: 31, submitDate: '2026-08-24', expectedEndDate: null,
    actualEndDate: null, completionStatus: null, ...submitter,
  }, { product_id: 75 }, { id: 88 }, null, 99)
  await saveWorkOrder(tx, {
    externalCode: 'I8-SUBMITTER-WO', problemTypeName: '日常操作', problemDescription: '来源工单',
    syncedSection: '<p>来源工单</p>', solution: null, priority: 1, status: 1,
    submitDate: '2026-08-24', expectedEndDate: null, actualEndDate: null, ...submitter,
  }, { product_id: 75 }, { id: 88 }, null, 99)

  const requirementInsert = calls.find((call) => call.sql.includes('INSERT INTO pms_requirement'))
  const workOrderInsert = calls.find((call) => call.sql.includes('INSERT INTO pms_work_order'))
  assert.ok(requirementInsert)
  assert.ok(workOrderInsert)
  assert.doesNotMatch(requirementInsert.sql, /submitter_name,'i8'|submitter_name,submitter_dept[\s\S]*'i8'/)
  assert.doesNotMatch(workOrderInsert.sql, /submitter_name,'i8'|submitter_name,submitter_dept[\s\S]*'i8'/)
  assert.ok(requirementInsert.params.includes('徐波'))
  assert.ok(requirementInsert.params.includes('建筑工程公司项目部'))
  assert.ok(workOrderInsert.params.includes('徐波'))
  assert.ok(workOrderInsert.params.includes('建筑工程公司项目部'))
})

test('i8 更新需求和工单时刷新来源提交信息并写入变更历史', async () => {
  const calls = []
  const writes = []
  const tx = {
    prepare(sql) {
      return {
        get: async () => sql.includes('FROM pms_archive') ? { id: 7 } : null,
        run: async (...params) => {
          calls.push({ sql, params })
          return { changes: 1 }
        },
      }
    },
    writeLogs: async (...params) => writes.push(params),
  }
  const submitter = { submitterName: '徐波', submitterDept: '建筑工程公司项目部' }

  await saveRequirement(tx, {
    title: '来源需求', externalCode: 'I8-SUBMITTER-REQ', syncedSection: '<p>来源需求</p>',
    priority: 0, status: 31, submitDate: '2026-08-24', expectedEndDate: null,
    actualEndDate: null, completionStatus: null, ...submitter,
  }, { product_id: 75 }, { id: 88 }, {
    id: 401, title: '来源需求', description: '<!-- i8-sync:start -->\n<p>来源需求</p>\n<!-- i8-sync:end -->',
    requirement_type: 4, product_id: 75, owner_id: 88, priority: 0, status: 31, is_overdue: 0,
    submitter_name: 'i8', submitter_dept: 'i8', submit_date: '2026-08-24', expected_end_date: null,
    actual_end_date: null, completion_status: null,
  }, 99)
  await saveWorkOrder(tx, {
    externalCode: 'I8-SUBMITTER-WO', problemTypeName: '日常操作', problemDescription: '来源工单',
    syncedSection: '<p>来源工单</p>', solution: null, priority: 1, status: 1,
    submitDate: '2026-08-24', expectedEndDate: null, actualEndDate: null, ...submitter,
  }, { product_id: 75 }, { id: 88 }, {
    id: 402, product_id: 75, problem_type: 7,
    problem_desc: '<!-- i8-sync:start -->\n<p>来源工单</p>\n<!-- i8-sync:end -->', result_desc: null,
    follower_id: 88, urgency: 1, status: 1, is_overdue: 0, expected_resolve_date: null,
    resolve_date: null, submitter_name: 'i8', submitter_dept: 'i8', submit_time: '2026-08-24',
  }, 99)

  const requirementUpdate = calls.find((call) => call.sql.includes('UPDATE pms_requirement'))
  const workOrderUpdate = calls.find((call) => call.sql.includes('UPDATE pms_work_order'))
  assert.ok(requirementUpdate.params.includes('徐波'))
  assert.ok(requirementUpdate.params.includes('建筑工程公司项目部'))
  assert.ok(workOrderUpdate.params.includes('徐波'))
  assert.ok(workOrderUpdate.params.includes('建筑工程公司项目部'))
  assert.deepEqual(writes[0][4], [
    { field: 'submitter_name', oldVal: 'i8', newVal: '徐波' },
    { field: 'submitter_dept', oldVal: 'i8', newVal: '建筑工程公司项目部' },
  ])
  assert.deepEqual(writes[1][4], [
    { field: 'submitter_name', oldVal: 'i8', newVal: '徐波' },
    { field: 'submitter_dept', oldVal: 'i8', newVal: '建筑工程公司项目部' },
  ])
})

test('i8 更新运维工单时按字段记录真实变化', async () => {
  const writes = []
  const tx = {
    prepare(sql) {
      return {
        get: async () => sql.includes('FROM pms_archive') ? { id: 7 } : null,
        run: async () => ({ changes: 1 }),
      }
    },
    writeLogs: async (...params) => writes.push(params),
  }
  const syncedSection = '<p>问题描述：无法登录</p>'
  const problemDesc = `<!-- i8-sync:start -->\n${syncedSection}\n<!-- i8-sync:end -->`

  await saveWorkOrder(tx, {
    externalCode: 'I8-WO-2', problemTypeName: '日常操作', problemDescription: '无法登录',
    syncedSection, solution: null, priority: 2, status: 1,
    submitDate: '2026-08-24', expectedEndDate: null, actualEndDate: null,
  }, { product_id: 75 }, { id: 88 }, {
    id: 202, product_id: 75, problem_type: 7, problem_desc: problemDesc, result_desc: null,
    follower_id: 88, urgency: 1, status: 1, is_overdue: 0,
    expected_resolve_date: null, resolve_date: null, submitter_name: 'i8',
    submitter_dept: 'i8', submit_time: '2026-08-24',
  }, 99)

  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].slice(0, 4), [99, 'i8同步更新', '运维工单', 202])
  assert.deepEqual(writes[0][4], [{ field: 'urgency', oldVal: 1, newVal: 2 }])
  assert.equal(writes[0][6], '无法登录')
})

test('同步映射版本变化时即使源记录未变化也会重新处理', () => {
  const record = { 单据编码: 'I8-001', 问题描述: '同一份源数据' }

  assert.notEqual(payloadHash(record), payloadHash(record, 'previous-description-layout'))
})

test('新建需求查重时不向 PostgreSQL 传无法推断类型的空目标 ID', async () => {
  const calls = []
  const tx = {
    prepare(sql) {
      return {
        get: async (...params) => {
          calls.push({ sql, params })
          if (sql.includes('? IS NULL')) {
            throw new Error('could not determine data type of parameter $2')
          }
          return null
        },
      }
    },
  }

  const title = await uniqueRequirementTitle(tx, '需要同步的需求', 'I8-001', null)

  assert.equal(title, '需要同步的需求')
  assert.deepEqual(calls[0].params, ['需要同步的需求'])
})

test('i8 配置查询按 ID 或编码使用明确参数类型', async () => {
  const calls = []
  const database = {
    prepare(sql) {
      return {
        get: async (...params) => {
          calls.push({ sql, params })
          if (sql.includes('FROM pms_integration_config')) {
            return { id: params[0], config_json: { product_id: 75, fallback_owner_id: 88 } }
          }
          if (sql.includes('FROM pms_product')) return { id: 75, name: 'i8项目管理系统' }
          if (sql.includes('FROM pms_user')) return { id: 88, name: '韩健' }
          return null
        },
      }
    },
  }

  await getConfig(database, 7)
  await getConfig(database)

  const configCalls = calls.filter((call) => call.sql.includes('FROM pms_integration_config'))
  assert.match(configCalls[0].sql, /WHERE c\.id=\?/)
  assert.doesNotMatch(configCalls[0].sql, /\? IS (?:NOT )?NULL/)
  assert.deepEqual(configCalls[0].params, [7])
  assert.match(configCalls[1].sql, /WHERE c\.code=\?/)
  assert.deepEqual(configCalls[1].params, ['i8_it_operations'])
})

test('旧接口配置缺少业务参数时按已确认默认规则补齐产品和兜底负责人', async () => {
  const calls = []
  const database = {
    prepare(sql) {
      return {
        get: async (...params) => {
          calls.push({ sql, params })
          if (sql.includes('FROM pms_integration_config')) {
            return { id: 1, code: 'i8_it_operations', config_json: {} }
          }
          if (sql.includes('FROM pms_product')) {
            return { id: 75, name: 'i8项目管理系统' }
          }
          if (sql.includes('FROM pms_user')) {
            return { id: 88, name: '韩健' }
          }
          return null
        },
      }
    },
  }

  const config = await getConfig(database, 1)

  assert.equal(config.config_json.product_id, 75)
  assert.equal(config.product_name, 'i8项目管理系统')
  assert.equal(config.config_json.fallback_owner_id, 88)
  assert.equal(config.fallback_owner_name, '韩健')
  assert.match(calls[1].sql, /name='i8项目管理系统'/)
  assert.match(calls[2].sql, /real_name='韩健'/)
})

test('旧接口配置中的业务对象已失效时回退到已确认默认对象', async () => {
  const database = {
    prepare(sql) {
      return {
        get: async () => {
          if (sql.includes('FROM pms_integration_config')) {
            return {
              id: 1,
              code: 'i8_it_operations',
              config_json: { product_id: 999, fallback_owner_id: 998 },
            }
          }
          if (sql.includes('FROM pms_product') && sql.includes('id=?')) return null
          if (sql.includes('FROM pms_product')) return { id: 75, name: 'i8项目管理系统' }
          if (sql.includes('FROM pms_user') && sql.includes('id=?')) return null
          if (sql.includes('FROM pms_user')) return { id: 88, name: '韩健' }
          return null
        },
      }
    },
  }

  const config = await getConfig(database, 1)

  assert.equal(config.config_json.product_id, 75)
  assert.equal(config.product_name, 'i8项目管理系统')
  assert.equal(config.config_json.fallback_owner_id, 88)
  assert.equal(config.fallback_owner_name, '韩健')
})

test('i8 接口调用只传开始日期，结束日期固定为空', async () => {
  let received
  const records = await requestExternalRecords(
    { endpoint_url: 'http://example.test/sync' },
    { start: '2026-08-24', end: '2026-08-25' },
    async (url, options) => {
      received = { url, options }
      return { ok: true, json: async () => ({ status: 'success', data: [{ 单据编码: 'I8-1' }] }) }
    },
  )

  assert.equal(received.url, 'http://example.test/sync')
  assert.equal(received.options.method, 'POST')
  assert.deepEqual(JSON.parse(received.options.body), { kssj: '2026-08-24', jssj: '' })
  assert.deepEqual(records, [{ 单据编码: 'I8-1' }])
})

test('i8 接口异常和错误业务状态返回明确错误', async () => {
  await assert.rejects(
    () => requestExternalRecords(
      { endpoint_url: 'http://example.test/sync' },
      { start: '2026-08-24', end: '2026-08-24' },
      async () => ({ ok: false, status: 502, json: async () => ({}) }),
    ),
    /HTTP 502/,
  )
  await assert.rejects(
    () => requestExternalRecords(
      { endpoint_url: 'http://example.test/sync' },
      { start: '2026-08-24', end: '2026-08-24' },
      async () => ({ ok: true, json: async () => ({ status: 'failed', message: '来源系统异常' }) }),
    ),
    /来源系统异常/,
  )
})

test('i8 接口明确返回数据未找到时按空结果处理', async () => {
  const records = await requestExternalRecords(
    { endpoint_url: 'http://example.test/sync' },
    { start: '2026-08-24', end: '2026-08-24' },
    async () => ({
      ok: true,
      json: async () => ({ status: 'error', message: '数据未找到', data: null }),
    }),
  )

  assert.deepEqual(records, [])
})

test('测试连接使用配置的首次同步日期且不依赖同步落库的产品和兜底负责人配置', async () => {
  let requestBody
  const result = await testConnection(
    {
      endpoint_url: 'http://example.test/sync',
      config_json: {},
      initial_sync_date: '2026-08-01',
      last_cursor_at: null,
    },
    async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return {
      ok: true,
      json: async () => ({ status: 'success', data: [{ 单据编码: 'I8-1' }] }),
      }
    },
  )

  assert.equal(result.connected, true)
  assert.equal(result.recordCount, 1)
  assert.deepEqual(requestBody, { kssj: '2026-08-01', jssj: '' })
})
