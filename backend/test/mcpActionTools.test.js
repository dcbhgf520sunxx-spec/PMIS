const assert = require('node:assert/strict')
const test = require('node:test')

const {
  dispatchActionTool: dispatchActionToolWithDb,
  loadActionTargetSnapshot,
  mergeActionUpdateArguments,
  resolvePreviewDisplay,
  validateStatusAction,
} = require('../src/mcp/actionTools')
const { hashActionArguments } = require('../src/services/mcpActionTicketService')

// Unit fixtures replace transaction boundaries explicitly. The pg-level atomic
// rollback, nesting and isolation regressions live in mcpActionReliability.test.
const dispatchActionTool = (name, args, context, dependencies) => dispatchActionToolWithDb(name, args, context, {
  runTransaction: (callback) => callback(), runSavepoint: (callback) => callback(), lockTargets: async () => {},
  resolvePreviewDisplay: async (_name, args) => Object.fromEntries(Object.entries(args)
    .filter(([key]) => !['mode', 'confirmation_id', 'idempotency_key'].includes(key))),
  ...dependencies,
})

test('task preview exposes business names while keeping raw execute arguments unchanged', async () => {
  let ticketPreview
  const database = {
    prepare(sql) {
      if (sql.includes('FROM pms_project WHERE')) return { async get() { return { name: '绿色建筑培训项目' } } }
      if (sql.includes('FROM pms_archive WHERE')) return { async get() { return { name: '培训任务' } } }
      if (/FROM pms_user\s+WHERE/.test(sql)) return { async all() { return [{ id: 8, name: '孙鑫鑫' }] } }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  const args = {
    name: '开展 Codex 基础培训',
    source_type: 1,
    project_id: 13,
    task_type: 33,
    owner_ids: [8],
    expected_end_date: '2026-09-18',
    idempotency_key: 'task-display-preview-1',
    mode: 'preview',
  }
  const result = await dispatchActionToolWithDb('task_create', args, {
    client: { id: 3 },
    user: { id: 8, employeeNo: '005829', realName: '孙鑫鑫' },
  }, {
    actions: { task_create: [async () => {}, () => ({ body: {} })] },
    database,
    validateBusinessRules: async () => {},
    loadTarget: async () => ({ type: 'task', id: null, name: args.name, current: null }),
    ticketService: {
      createTicket: async (_context, _name, _args, preview) => {
        ticketPreview = preview
        return { confirmationId: 'ticket-display-1', preview }
      },
    },
  })

  assert.deepEqual(ticketPreview.displayChanges, {
    name: '开展 Codex 基础培训',
    source_type: '项目',
    project_id: '绿色建筑培训项目',
    task_type: '培训任务',
    owner_ids: ['孙鑫鑫'],
    expected_end_date: '2026-09-18',
  })
  assert.equal(result.executeArguments.project_id, 13)
  assert.equal(result.executeArguments.task_type, 33)
  assert.deepEqual(result.executeArguments.owner_ids, [8])
})

test('preview display resolves enums, archive references, people and nested batch items', async () => {
  const database = {
    prepare(sql) {
      if (/FROM pms_user\s+WHERE/.test(sql)) return {
        async all(...ids) { return ids.map((id) => ({ id, name: { 8: '孙鑫鑫', 9: '协作人' }[id] })) },
      }
      if (sql.includes('FROM pms_archive WHERE')) return {
        async get(id) { return { name: { 41: '功能缺陷', 42: '代码修复', 43: '软件供应商' }[id] } },
      }
      if (sql.includes('FROM pms_project WHERE')) return { async get() { return { name: 'SIDM 项目' } } }
      if (sql.includes('FROM pms_project_plan_stage WHERE')) return { async get() { return { name: '实施阶段' } } }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  const bug = await resolvePreviewDisplay('bug_change_status', {
    id: 20, status: 1, resolution_id: 42, assignee_id: 8, mode: 'preview',
  }, database, { type: 'bug', id: 20, name: '登录失败', current: {} })
  assert.deepEqual(bug, { id: '登录失败', status: '已修复', resolution_id: '代码修复', assignee_id: '孙鑫鑫' })

  const batch = await resolvePreviewDisplay('stage_item_batch_create', {
    project_id: 13,
    stage_id: 7,
    items: [{ name: '上线', owner_id: 8, collaborator_ids: [9], requires_delivery_file: 1 }],
    mode: 'preview',
  }, database, { type: 'stage', id: 7, name: '实施阶段', current: {} })
  assert.deepEqual(batch, {
    project_id: 'SIDM 项目',
    stage_id: '实施阶段',
    items: [{ name: '上线', owner_id: '孙鑫鑫', collaborator_ids: ['协作人'], requires_delivery_file: '要求' }],
  })
})

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
    validateBusinessRules: async () => {},
    loadTarget: async () => ({
      type: 'task',
      id: 9,
      name: '原任务名称',
      current: { status: 0, owner_ids: [8] },
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
    current: { status: 0, owner_ids: [8] },
  })
})

test('task sparse preview validates current fields but binds only the supplied edit intent', async () => {
  let ticketArgs
  const currentTask = {
    name: '原任务',
    description: '原说明',
    source_type: 1,
    project_id: 2,
    requirement_id: null,
    task_type: 3,
    start_date: '2026-07-24',
    expected_end_date: '2026-07-31',
  }
  const database = {
    prepare(sql) {
      if (sql.includes('FROM pms_task_owner')) return { async all() { return [{ id: 8 }] } }
      return { async get() { return currentTask } }
    },
  }
  await dispatchActionTool('task_update', { id: 59, description: '更新说明', mode: 'preview' }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: '005829', realName: '孙鑫鑫' },
  }, {
    actions: { task_update: [async () => {}, () => ({ body: {} })] },
    database,
    validateBusinessRules: async () => {},
    loadTarget: async () => ({ type: 'task', id: 59, name: '原任务', current: { status: 0, owner_ids: [8] } }),
    ticketService: {
      async createTicket(_context, _name, args) {
        ticketArgs = args
        return { confirmationId: 'ticket-1' }
      },
    },
  })
  assert.deepEqual(ticketArgs, {
    id: 59,
    mode: 'preview',
    description: '更新说明',
  })
})

test('action preview rejects a missing target before creating a confirmation ticket', async () => {
  let ticketCreated = false
  await assert.rejects(
    dispatchActionTool('task_delete', { id: 404, mode: 'preview' }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      validateBusinessRules: async () => {},
      loadTarget: async () => { throw new Error('任务不存在') },
      ticketService: {
        createTicket: async () => { ticketCreated = true },
      },
    }),
    /任务不存在/
  )
  assert.equal(ticketCreated, false)
})

test('action preview rejects a target that the current employee is not responsible for', async () => {
  let ticketCreated = false
  await assert.rejects(
    dispatchActionTool('project_update', {
      id: 9,
      name: '项目管理系统',
      product_id: 2,
      owner_id: 6,
      expected_end_date: '2026-08-31',
      mode: 'preview',
    }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      mergeArguments: async (_name, value) => value,
      validateStatus: async () => {},
      validateBusinessRules: async () => {},
      loadTarget: async () => ({
        type: 'project',
        id: 9,
        name: '项目管理系统',
        current: { owner_id: 6, status: 1 },
      }),
      ticketService: {
        createTicket: async () => { ticketCreated = true },
      },
    }),
    (error) => error.code === 'MCP_ACTION_NOT_RESPONSIBLE'
      && /只能操作本人负责或创建的项目/.test(error.message)
  )
  assert.equal(ticketCreated, false)
})

test('action preview allows a multi-owner task when the current employee is one of its owners', async () => {
  let ticketCreated = false
  await dispatchActionTool('task_change_status', {
    id: 9,
    status: 1,
    mode: 'preview',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }, {
    mergeArguments: async (_name, value) => value,
    validateStatus: async () => {},
    validateBusinessRules: async () => {},
    loadTarget: async () => ({
      type: 'task',
      id: 9,
      name: '多人任务',
      current: { owner_ids: [6, 8], status: 0 },
    }),
    ticketService: {
      createTicket: async () => {
        ticketCreated = true
        return { confirmationId: 'ticket-owner' }
      },
    },
  })
  assert.equal(ticketCreated, true)
})

test('batch action rejects the whole preview when any target is not owned by the current employee', async () => {
  let ticketCreated = false
  await assert.rejects(
    dispatchActionTool('task_assign', {
      ids: [9, 10],
      owner_ids: [7],
      mode: 'preview',
    }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      mergeArguments: async (_name, value) => value,
      validateStatus: async () => {},
      validateBusinessRules: async () => {},
      loadTarget: async () => ({
        type: 'task',
        ids: [9, 10],
        name: '2条任务',
        current: [
          { id: 9, name: '本人任务', owner_ids: [8], status: 0 },
          { id: 10, name: '他人任务', owner_ids: [6], status: 0 },
        ],
      }),
      ticketService: {
        createTicket: async () => { ticketCreated = true },
      },
    }),
    (error) => error.code === 'MCP_ACTION_NOT_RESPONSIBLE'
      && /#10 他人任务/.test(error.message)
  )
  assert.equal(ticketCreated, false)
})

test('stage reorder allows the project owner', async () => {
  let ticketCreated = false
  const database = {
    prepare(sql) {
      if (sql.includes('FROM pms_project WHERE')) {
        return { async get() { return { id: 2, name: '项目管理系统', owner_id: 8 } } }
      }
      if (sql.includes('FROM pms_project_plan_stage')) {
        return { async all() { return [
          { id: 11, name: '立项', sort_order: 1 },
          { id: 12, name: '实施', sort_order: 2 },
        ] } }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  await dispatchActionTool('stage_reorder', {
    project_id: 2,
    ids: [12, 11],
    moved_id: 12,
    mode: 'preview',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }, {
    database,
    mergeArguments: async (_name, value) => value,
    validateStatus: async () => {},
    validateBusinessRules: async () => {},
    ticketService: {
      createTicket: async () => {
        ticketCreated = true
        return { confirmationId: 'stage-order-ticket' }
      },
    },
  })

  assert.equal(ticketCreated, true)
})

test('stage item reorder rejects the whole list when one item belongs to another employee', async () => {
  let ticketCreated = false
  const database = {
    prepare(sql) {
      if (sql.includes('FROM pms_project_plan_stage s')) {
        return { async get() { return { id: 21, name: '实施阶段' } } }
      }
      if (sql.includes('FROM pms_project_plan_item')) {
        return { async all() { return [
          { id: 31, name: '本人事项', sort_order: 1, owner_id: 8 },
          { id: 32, name: '他人事项', sort_order: 2, owner_id: 6 },
        ] } }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  await assert.rejects(
    dispatchActionTool('stage_item_reorder', {
      project_id: 2,
      stage_id: 21,
      ids: [32, 31],
      moved_id: 32,
      mode: 'preview',
    }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      database,
      mergeArguments: async (_name, value) => value,
      validateStatus: async () => {},
      validateBusinessRules: async () => {},
      ticketService: {
        createTicket: async () => { ticketCreated = true },
      },
    }),
    (error) => error.code === 'MCP_ACTION_NOT_RESPONSIBLE'
      && /#32 他人事项/.test(error.message)
  )
  assert.equal(ticketCreated, false)
})

test('execute rechecks ownership and rejects when responsibility changed after preview', async () => {
  let ticketConsumed = false
  let writeCalled = false
  await assert.rejects(
    dispatchActionTool('bug_change_status', {
      id: 9,
      status: 1,
      confirmation_id: 'ticket-ownership-changed',
      mode: 'execute',
    }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: 'JS001', realName: '张三' },
    }, {
      actions: {
        bug_change_status: [
          async () => { writeCalled = true },
          () => ({ body: {} }),
        ],
      },
      mergeArguments: async (_name, value) => value,
      validateStatus: async () => {},
      validateBusinessRules: async () => {},
      loadTarget: async () => ({
        type: 'bug',
        id: 9,
        name: '登录失败',
        current: { assignee_id: 6, status: 0 },
      }),
      ticketService: {
        consumeTicket: async () => { ticketConsumed = true },
        markTicketFailed: async () => {},
      },
    }),
    (error) => error.code === 'MCP_ACTION_NOT_RESPONSIBLE'
      && /负责人已发生变化/.test(error.message)
  )
  assert.equal(ticketConsumed, true)
  assert.equal(writeCalled, false)
})

test('standalone create remains available before a responsible employee exists on the target', async () => {
  let ticketCreated = false
  await dispatchActionTool('task_create', {
    name: '新任务',
    source_type: 1,
    project_id: 2,
    task_type: 3,
    owner_ids: [6],
    priority: 1,
    expected_end_date: '2026-08-31',
    idempotency_key: 'new-task-1',
    mode: 'preview',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }, {
    mergeArguments: async (_name, value) => value,
    validateStatus: async () => {},
    validateBusinessRules: async () => {},
    loadTarget: async () => ({
      type: 'task',
      id: null,
      name: '新任务',
      current: null,
    }),
    ticketService: {
      createTicket: async () => {
        ticketCreated = true
        return { confirmationId: 'ticket-create' }
      },
    },
  })
  assert.equal(ticketCreated, true)
})

test('target snapshot verifies an existing task and returns only confirmation-safe current fields', async () => {
  const database = {
    prepare(sql) {
      assert.match(sql, /pms_task/)
      assert.match(sql, /pms_task_owner/)
      return {
        async get(id) {
          assert.equal(id, 9)
          return {
            id: 9,
            name: '原任务名称',
            status: 1,
            priority: 1,
            source_type: 1,
            project_id: 2,
            requirement_id: null,
            owner_ids: [6, 8],
            creator_id: 7,
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
      priority: 1,
      source_type: 1,
      project_id: 2,
      requirement_id: null,
      owner_ids: [6, 8],
      creator_id: 7,
    },
  })
})

test('batch and other high-impact actions are labeled high risk in preview', async () => {
  let preview
  await dispatchActionTool('stage_item_batch_create', {
    project_id: 1,
    stage_id: 2,
    items: [{ name: '上线', owner_id: 1, original_due_date: '2026-08-01' }],
    idempotency_key: 'stage-items-1',
    mode: 'preview',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }, {
    validateBusinessRules: async () => {},
    loadTarget: async () => ({ type: 'stage', id: 2, name: '实施阶段', current: { owner_id: 8 } }),
    ticketService: {
      createTicket: async (_context, _name, _args, value) => {
        preview = value
        return value
      },
    },
  })

  assert.equal(preview.riskLevel, 'high')
})

test('file action preview keeps file metadata but redacts the OSS URL and control fields', async (t) => {
  const { OSS_FILE_ORIGIN } = require('../src/services/projectContractOssService')
  t.mock.method(global, 'fetch', async () => new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } }))
  let preview
  await dispatchActionTool('contract_attachment_upload', {
    project_id: 1,
    file_name: '合同.pdf',
    mime_type: 'application/pdf',
    file_url: `${OSS_FILE_ORIGIN}/pmis/contracts/a.pdf`,
    idempotency_key: 'contract-file-1',
    mode: 'preview',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: 'JS001', realName: '张三' },
  }, {
    validateBusinessRules: async () => {},
    loadTarget: async () => ({ type: 'contract', id: 2, name: '建设合同', current: { owner_id: 8 } }),
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
    file_url: '[FILE_URL]',
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
            owner_id: 8,
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
    current: { project_id: 2, item_id: 9, size_bytes: 1024, owner_id: 8 },
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
        consumeTicket: async () => {
          consumed = true
          return { preview: { _executionState: { version: 1, fields: Object.fromEntries(
            ['name', 'source_type', 'project_id', 'task_type', 'owner_ids'].map((field) => [field, hashActionArguments({ value: null })])
          ) } } }
        },
        markTicketFailed: async () => {
          failureMarked = true
          throw new Error('票据状态更新失败')
        },
      },
      mergeArguments: async (_name, value) => value,
      validateStatus: async () => {},
      validateBusinessRules: async () => {},
      loadTarget: async () => ({ type: 'task', id: 9, name: '任务', current: { owner_ids: [8] } }),
    }),
    (error) => error.code === 'MCP_EXECUTION_OUTCOME_UNKNOWN' && error.cause === businessError
  )

  assert.equal(consumed, true)
  assert.equal(failureMarked, true)
})

test('action execute returns an unambiguous success envelope even when the business result contains a false flag', async () => {
  const target = {
    type: 'task',
    id: 80,
    name: '智能体对接到桌宠的功能',
    current: { status: 1, owner_ids: [8] },
  }
  const result = await dispatchActionTool('task_change_status', {
    id: 80,
    status: 2,
    actual_end_date: '2026-07-31',
    mode: 'execute',
    confirmation_id: '00000000-0000-4000-8000-000000000001',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: '005829', realName: '孙鑫鑫' },
  }, {
    actions: {
      task_change_status: [
        async (_req, res) => res.json({
          code: 0,
          data: {
            task: { id: 80, status: 2 },
            allSubtasksCompleted: false,
          },
        }),
        (value) => ({ body: value }),
      ],
    },
    ticketService: {
      consumeTicket: async () => {},
      markTicketFailed: async () => {},
    },
    database: {
      prepare(sql) {
        return {
          async get() {
            if (sql.includes('COUNT(*)::INTEGER total')) {
              return { total: 0, completed: 0 }
            }
            return {
              id: 80,
              status: 1,
              parent_task_id: null,
              parent_status: null,
            }
          },
        }
      },
    },
    mergeArguments: async (_name, value) => value,
    validateBusinessRules: async () => {},
    loadTarget: async () => target,
  })

  assert.equal(result.success, true)
  assert.equal(result.executed, true)
  assert.equal(result.resultStatus, 'success')
  assert.equal(result.outcome, 'executed')
  assert.equal(result.message, '操作已成功执行')
  assert.equal(result.tool, 'task_change_status')
  assert.deepEqual(result.target, target)
  assert.deepEqual(result.changes, {
    id: 80,
    status: 2,
    actual_end_date: '2026-07-31',
  })
  assert.equal(result.businessResult.allSubtasksCompleted, false)
})

test('business attachment delete verifies the attachment is no longer active before reporting success', async () => {
  const queries = []
  const result = await dispatchActionTool('business_attachment_delete', {
    business_type: 'task',
    business_id: 80,
    attachment_id: 12,
    mode: 'execute',
    confirmation_id: '00000000-0000-4000-8000-000000000012',
  }, {
    client: { id: 3 },
    user: { id: 8, employeeNo: '005829', realName: '孙鑫鑫' },
    allowedMenuPaths: new Set(['/tasks']),
  }, {
    actions: {
      business_attachment_delete: [
        async (_req, res) => res.json({ code: 0, data: null }),
        () => ({ body: {} }),
      ],
    },
    ticketService: {
      consumeTicket: async () => {},
      markTicketFailed: async () => {},
    },
    database: {
      prepare(sql) {
        queries.push(sql)
        return { async get() { return { is_deleted: 1 } } }
      },
    },
    mergeArguments: async (_name, value) => value,
    validateStatus: async () => {},
    validateBusinessRules: async () => {},
    loadTarget: async () => ({
      type: 'task',
      id: 80,
      name: '测试MCP文件上传新增',
      current: { owner_ids: [8] },
      attachment: { id: 12, name: '狗子.webp' },
    }),
  })

  assert.match(queries.at(-1), /FROM pms_business_attachment/)
  assert.equal(result.message, '操作已成功执行并通过结果校验')
  assert.deepEqual(result.verification, {
    verified: true,
    type: 'attachment_deleted',
    businessType: 'task',
    businessId: 80,
    attachmentId: 12,
    active: false,
  })
})

test('business attachment delete fails clearly when the attachment remains active', async () => {
  let failureMarked = false
  await assert.rejects(
    dispatchActionTool('business_attachment_delete', {
      business_type: 'task',
      business_id: 80,
      attachment_id: 12,
      mode: 'execute',
      confirmation_id: '00000000-0000-4000-8000-000000000013',
    }, {
      client: { id: 3 },
      user: { id: 8, employeeNo: '005829', realName: '孙鑫鑫' },
      allowedMenuPaths: new Set(['/tasks']),
    }, {
      actions: {
        business_attachment_delete: [
          async (_req, res) => res.json({ code: 0, data: null }),
          () => ({ body: {} }),
        ],
      },
      ticketService: {
        consumeTicket: async () => {},
        markTicketFailed: async () => { failureMarked = true },
      },
      database: {
        prepare() {
          return { async get() { return { is_deleted: 0 } } }
        },
      },
      mergeArguments: async (_name, value) => value,
      validateStatus: async () => {},
      validateBusinessRules: async () => {},
      loadTarget: async () => ({
        type: 'task',
        id: 80,
        name: '测试MCP文件上传新增',
        current: { owner_ids: [8] },
        attachment: { id: 12, name: '狗子.webp' },
      }),
    }),
    (error) => error.code === 'MCP_RESULT_VERIFICATION_FAILED'
      && error.message === '附件删除后校验失败，附件仍然存在'
  )
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
      submitter_dept: '技术部',
      start_date: '2026-07-02',
      expected_end_date: '2026-08-01',
    },
    pms_task: {
      description: '任务说明',
      project_id: 12,
      requirement_id: null,
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
      member_ids: [3, 8],
    }
  )
  assert.deepEqual(
    await mergeActionUpdateArguments('task_update', { id: 4 }, database),
    {
      id: 4,
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
      && error.fieldErrors.status === '当前状态：待处理(0)；允许变更为：处理中(1)、已暂停(3)'
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
    validateStatusAction('bug_change_status', {
      id: 5,
      status: 1,
      resolved_date: '2026-07-28',
      resolution_id: 9,
    }, databaseFor('bug_change_status')),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Boolean(error.fieldErrors.assignee_id)
  )
  await assert.rejects(
    validateStatusAction('bug_change_status', {
      id: 5,
      status: 3,
      activation_reason: '问题再次复现',
    }, { prepare() { return { async get() { return { status: 2 } } } } }),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Boolean(error.fieldErrors.assignee_id)
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
    assignee_id: 8,
  }, databaseFor('bug_change_status')))
  await assert.doesNotReject(validateStatusAction('bug_change_status', {
    id: 5,
    status: 3,
    activation_reason: '问题再次复现',
    assignee_id: 8,
  }, { prepare() { return { async get() { return { status: 2 } } } } }))
  await assert.doesNotReject(validateStatusAction('work_order_change_status', {
    id: 6,
    status: 2,
    resolve_date: '2026-07-28',
    result_desc: '已完成修复并验证',
  }, databaseFor('work_order_change_status')))
})
