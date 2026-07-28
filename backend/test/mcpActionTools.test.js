const assert = require('node:assert/strict')
const test = require('node:test')

const {
  dispatchActionTool,
  loadActionTargetSnapshot,
  mergeActionUpdateArguments,
  validateStatusAction,
} = require('../src/mcp/actionTools')

test('action preview loads the current target without invoking a business write', async () => {
  let writeCalled = false
  let ticketPreview
  const context = {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }
  const result = await dispatchActionTool('task_update', {
    id: 9,
    name: '新任务名称',
    source_type: 1,
    project_id: 2,
    task_type: 3,
    owner_ids: [8],
    mode: 'preview',
  }, context, {
    actions: {
      task_update: [
        async () => { writeCalled = true },
        () => ({ body: {} }),
      ],
    },
    mergeArguments: async (_name, value) => value,
    loadTarget: async () => ({
      type: 'task',
      id: 9,
      name: '原任务名称',
      current: { status: 0, owner_ids: [6] },
    }),
    ticketService: {
      createTicket: async (_context, _name, _args, preview) => {
        ticketPreview = preview
        return { confirmationId: 'ticket-1', preview }
      },
    },
  })

  assert.equal(writeCalled, false)
  assert.equal(result.confirmationId, 'ticket-1')
  assert.deepEqual(ticketPreview.target, {
    type: 'task',
    id: 9,
    name: '原任务名称',
    current: { status: 0, owner_ids: [6] },
  })
})

test('action preview rejects a missing target before creating a confirmation ticket', async () => {
  let ticketCreated = false
  await assert.rejects(
    dispatchActionTool('task_delete', { id: 404, mode: 'preview' }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      loadTarget: async () => { throw new Error('任务不存在') },
      ticketService: {
        createTicket: async () => { ticketCreated = true },
      },
    }),
    /任务不存在/
  )
  assert.equal(ticketCreated, false)
})

test('target snapshot verifies an existing task and returns only confirmation-safe current fields', async () => {
  const database = {
    prepare(sql) {
      assert.match(sql, /pms_task/)
      return {
        async get(id) {
          assert.equal(id, 9)
          return {
            id: 9,
            name: '原任务名称',
            status: 1,
            source_type: 1,
            project_id: 2,
            requirement_id: null,
          }
        },
      }
    },
  }

  assert.deepEqual(await loadActionTargetSnapshot('task_change_status', { id: 9 }, database), {
    type: 'task',
    id: 9,
    name: '原任务名称',
    current: {
      status: 1,
      source_type: 1,
      project_id: 2,
      requirement_id: null,
    },
  })
})

test('batch and other high-impact actions are labeled high risk in preview', async () => {
  let preview
  await dispatchActionTool('stage_item_batch_create', {
    project_id: 1,
    stage_id: 2,
    items: [{ name: '上线', owner_id: 8, original_due_date: '2026-08-01' }],
    idempotency_key: 'stage-items-1',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }, {
    loadTarget: async () => ({ type: 'stage', id: 2, name: '实施阶段', current: {} }),
    ticketService: {
      createTicket: async (_context, _name, _args, value) => {
        preview = value
        return value
      },
    },
  })

  assert.equal(preview.riskLevel, 'high')
})

test('file action preview keeps file metadata but redacts the file body and control fields', async () => {
  let preview
  await dispatchActionTool('contract_attachment_upload', {
    project_id: 1,
    file_name: '合同.pdf',
    mime_type: 'application/pdf',
    content_base64: 'JVBERi0x',
    idempotency_key: 'contract-file-1',
    mode: 'preview',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }, {
    loadTarget: async () => ({ type: 'contract', id: 2, name: '建设合同', current: {} }),
    ticketService: {
      createTicket: async (_context, _name, _args, value) => {
        preview = value
        return value
      },
    },
  })

  assert.deepEqual(preview.changes, {
    project_id: 1,
    file_name: '合同.pdf',
    mime_type: 'application/pdf',
    content_base64: '[FILE_CONTENT]',
  })
})

test('delivery file target snapshot uses the real size_bytes column', async () => {
  const database = {
    prepare(sql) {
      assert.doesNotMatch(sql, /f\.file_size/)
      assert.match(sql, /f\.size_bytes/)
      return {
        async get(fileId, itemId, projectId) {
          assert.deepEqual([fileId, itemId, projectId], [5, 9, 2])
          return {
            id: 5,
            name: '验收报告.pdf',
            size_bytes: 1024,
            project_id: 2,
            item_id: 9,
          }
        },
      }
    },
  }

  assert.deepEqual(await loadActionTargetSnapshot('stage_delivery_delete', {
    project_id: 2,
    item_id: 9,
    file_id: 5,
  }, database), {
    type: 'stage_delivery',
    id: 5,
    name: '验收报告.pdf',
    current: { project_id: 2, item_id: 9, size_bytes: 1024 },
  })
})

test('batch target snapshots reject invalid numeric identifiers before querying', async () => {
  let queried = false
  const database = {
    prepare() {
      queried = true
      return { all: async () => [] }
    },
  }

  await assert.rejects(
    loadActionTargetSnapshot('task_assign', { ids: ['abc'] }, database),
    /任务标识不合法/
  )
  assert.equal(queried, false)
})

test('action execute consumes the ticket and preserves the business error when failure marking also fails', async () => {
  let consumed = false
  let failureMarked = false
  const businessError = new Error('任务状态不允许修改')

  await assert.rejects(
    dispatchActionTool('task_update', {
      id: 9,
      name: '任务',
      source_type: 1,
      project_id: 2,
      task_type: 3,
      owner_ids: [8],
      mode: 'execute',
      confirmation_id: '00000000-0000-4000-8000-000000000001',
    }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      actions: {
        task_update: [
          async () => { throw businessError },
          () => ({ body: {} }),
        ],
      },
      ticketService: {
        consumeTicket: async () => { consumed = true },
        markTicketFailed: async () => {
          failureMarked = true
          throw new Error('票据状态更新失败')
        },
      },
      mergeArguments: async (_name, value) => value,
    }),
    (error) => error === businessError
  )

  assert.equal(consumed, true)
  assert.equal(failureMarked, true)
})

test('edit arguments preserve omitted optional scalar fields from the current record', async () => {
  const rows = {
    pms_product: { description: '产品说明' },
    pms_project: {
      description: '项目说明',
      start_date: '2026-07-01',
      progress_text: '当前进度',
      risk_text: '当前风险',
    },
    pms_requirement: {
      description: '需求说明',
      project_id: 12,
      priority: 2,
      submitter_dept: '技术部',
      start_date: '2026-07-02',
      expected_end_date: '2026-08-01',
    },
    pms_task: {
      description: '任务说明',
      project_id: 12,
      requirement_id: null,
      priority: 2,
      start_date: '2026-07-03',
      expected_end_date: '2026-08-02',
    },
    pms_bug: {
      description: 'BUG说明',
      project_id: 12,
      requirement_id: null,
    },
    pms_project_plan_stage: { description: '阶段说明' },
    pms_project_contract: { remark: '合同备注' },
    pms_project_payment_record: { remark: '付款备注' },
  }
  const database = {
    prepare(sql) {
      if (sql.includes('FROM pms_project_member') || sql.includes('FROM pms_task_owner')) {
        return { async all() { return [] } }
      }
      const table = Object.keys(rows)
        .sort((left, right) => right.length - left.length)
        .find((name) => sql.includes(`FROM ${name}`))
      return { async get() { return rows[table] } }
    },
  }

  const cases = [
    ['product_update', { id: 1 }, { description: '产品说明' }],
    ['project_update', { id: 2 }, { ...rows.pms_project, member_ids: [] }],
    ['requirement_update', { id: 3 }, rows.pms_requirement],
    ['task_update', { id: 4 }, { ...rows.pms_task, owner_ids: [] }],
    ['bug_update', { id: 5 }, rows.pms_bug],
    ['stage_update', { project_id: 2, stage_id: 6 }, rows.pms_project_plan_stage],
    ['contract_update', { project_id: 2 }, rows.pms_project_contract],
    ['payment_update', { project_id: 2, payment_id: 7 }, rows.pms_project_payment_record],
  ]

  for (const [name, args, expected] of cases) {
    assert.deepEqual(
      await mergeActionUpdateArguments(name, args, database),
      { ...args, ...expected },
      name
    )
  }
})

test('edit arguments preserve omitted relationship arrays but respect explicit clearing', async () => {
  const database = {
    prepare(sql) {
      if (sql.includes('FROM pms_project_member')) {
        return { async all() { return [{ id: 3 }, { id: 8 }] } }
      }
      if (sql.includes('FROM pms_task_owner')) {
        return { async all() { return [{ id: 5 }, { id: 9 }] } }
      }
      if (sql.includes('FROM pms_project_plan_item_collaborator')) {
        return { async all() { return [{ id: 7 }] } }
      }
      if (sql.includes('FROM pms_project_plan_item')) {
        return {
          async get() {
            return {
              collaborator_ids: undefined,
              requires_delivery_file: 1,
              remark: '事项备注',
            }
          },
        }
      }
      return { async get() { return {} } }
    },
  }

  assert.deepEqual(
    await mergeActionUpdateArguments('project_update', { id: 2 }, database),
    {
      id: 2,
      description: null,
      start_date: null,
      progress_text: null,
      risk_text: null,
      member_ids: [3, 8],
    }
  )
  assert.deepEqual(
    await mergeActionUpdateArguments('task_update', { id: 4 }, database),
    {
      id: 4,
      description: null,
      project_id: null,
      requirement_id: null,
      priority: null,
      start_date: null,
      expected_end_date: null,
      owner_ids: [5, 9],
    }
  )
  assert.deepEqual(
    await mergeActionUpdateArguments('stage_item_update', {
      project_id: 2,
      item_id: 6,
      collaborator_ids: [],
    }, database),
    {
      project_id: 2,
      item_id: 6,
      collaborator_ids: [],
      requires_delivery_file: 1,
      remark: '事项备注',
    }
  )
})

test('status preview rejects illegal task transitions before creating a ticket', async () => {
  let ticketCreated = false
  const database = {
    prepare(sql) {
      assert.match(sql, /FROM pms_task/)
      return {
        async get() {
          return {
            id: 59,
            status: 0,
            previous_status: null,
            parent_task_id: 54,
            parent_status: 0,
          }
        },
      }
    },
  }

  await assert.rejects(
    dispatchActionTool('task_change_status', {
      id: 59,
      status: 2,
      actual_end_date: '2026-07-28',
      mode: 'preview',
    }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      database,
      loadTarget: async () => ({ type: 'task', id: 59, name: '开发并测试上线', current: { status: 0 } }),
      ticketService: {
        createTicket: async () => { ticketCreated = true },
      },
    }),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && error.fieldErrors.status === '当前任务状态不允许变更为目标状态'
  )
  assert.equal(ticketCreated, false)
})

test('status preview validates every conditional status field before issuing a ticket', async () => {
  const rows = {
    product_change_status: { status: 1 },
    project_change_status: { status: 1 },
    requirement_change_status: { status: 32, requirement_type: 4 },
    task_change_status: { status: 1, parent_task_id: 8, parent_status: 1 },
    bug_change_status: { status: 0 },
    work_order_change_status: {
      status: 1,
      resolve_date: null,
      close_date: null,
      result_desc: null,
      suspend_date: null,
      activation_reason: null,
    },
    stage_item_change_status: {
      status: 1,
      previous_status: null,
      requires_delivery_file: 0,
      active_file_count: 0,
    },
  }
  const databaseFor = (name) => ({
    prepare() {
      return { async get() { return rows[name] } }
    },
  })
  const cases = [
    ['product_change_status', { id: 1, status: 3 }, 'status'],
    ['project_change_status', { id: 2, status: 2 }, 'actual_end_date'],
    ['requirement_change_status', { id: 3, status: 33 }, 'actual_end_date'],
    ['task_change_status', { id: 4, status: 2 }, 'actual_end_date'],
    ['bug_change_status', { id: 5, status: 1 }, 'resolved_date'],
    ['work_order_change_status', { id: 6, status: 2 }, 'resolve_date'],
    ['stage_item_change_status', { project_id: 2, item_id: 7, status: 2 }, 'actual_end_date'],
  ]

  for (const [name, args, field] of cases) {
    await assert.rejects(
      validateStatusAction(name, args, databaseFor(name)),
      (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Boolean(error.fieldErrors[field]),
      name
    )
  }
})

test('status validation checks secondary required fields and accepts complete legal transitions', async () => {
  const rowFor = (name) => ({
    requirement_change_status: { status: 32, requirement_type: 4 },
    bug_change_status: { status: 0 },
    work_order_change_status: {
      status: 1,
      resolve_date: null,
      close_date: null,
      result_desc: null,
      suspend_date: null,
      activation_reason: null,
    },
  })[name]
  const databaseFor = (name) => ({
    prepare(sql) {
      if (sql.includes('FROM pms_archive a')) return { async get() { return { id: 9 } } }
      return { async get() { return rowFor(name) } }
    },
  })

  await assert.rejects(
    validateStatusAction('requirement_change_status', {
      id: 3,
      status: 33,
      actual_end_date: '2026-07-28',
    }, databaseFor('requirement_change_status')),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Boolean(error.fieldErrors.completion_status)
  )
  await assert.rejects(
    validateStatusAction('bug_change_status', {
      id: 5,
      status: 1,
      resolved_date: '2026-07-28',
    }, databaseFor('bug_change_status')),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Boolean(error.fieldErrors.resolution_id)
  )
  await assert.rejects(
    validateStatusAction('work_order_change_status', {
      id: 6,
      status: 2,
      resolve_date: '2026-07-28',
    }, databaseFor('work_order_change_status')),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Boolean(error.fieldErrors.result_desc)
  )

  await assert.doesNotReject(validateStatusAction('requirement_change_status', {
    id: 3,
    status: 33,
    actual_end_date: '2026-07-28',
    completion_status: '已验收',
  }, databaseFor('requirement_change_status')))
  await assert.doesNotReject(validateStatusAction('bug_change_status', {
    id: 5,
    status: 1,
    resolved_date: '2026-07-28',
    resolution_id: 9,
  }, databaseFor('bug_change_status')))
  await assert.doesNotReject(validateStatusAction('work_order_change_status', {
    id: 6,
    status: 2,
    resolve_date: '2026-07-28',
    result_desc: '已完成修复并验证',
  }, databaseFor('work_order_change_status')))
})
