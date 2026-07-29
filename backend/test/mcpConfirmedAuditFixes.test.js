const assert = require('node:assert/strict')
const test = require('node:test')

const {
  filterToolsForContext,
  getToolDefinition,
  resolvePublicTool,
} = require('../src/mcp/catalog')
const { buildAuditSummary, resultCount, validateToolArguments } = require('../src/mcp/dispatcher')
const { dispatchActionTool } = require('../src/mcp/actionTools')
const { validateActionBusinessRules } = require('../src/mcp/actionTools')
const { buildTaskSearchInput, dispatchQueryTool } = require('../src/mcp/queryTools')
const { redactAuditInput } = require('../src/services/mcpAuditService')

test('date validation rejects impossible calendar dates and invalid date order', () => {
  const definition = getToolDefinition('task_create', 'action')

  assert.throws(
    () => validateToolArguments(definition, {
      name: '日期校验',
      source_type: 1,
      project_id: 10,
      task_type: 2,
      owner_ids: [8],
      priority: 1,
      start_date: '2026-02-30',
      expected_end_date: '2026-02-28',
      idempotency_key: 'invalid-calendar-date',
    }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && Boolean(error.fieldErrors.start_date)
      && Boolean(error.fieldErrors.expected_end_date)
  )
})

test('argument validation returns every unknown field in one response', () => {
  const definition = getToolDefinition('task_update', 'action')

  assert.throws(
    () => validateToolArguments(definition, {
      id: 59,
      priorityName: '中',
      finishDat: '2026-07-31',
      creatorId: 8,
    }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && Object.keys(error.fieldErrors).length === 3
      && /priority/.test(error.fieldErrors.priorityName)
      && /expected_end_date/.test(error.fieldErrors.finishDat)
      && /只读/.test(error.fieldErrors.creatorId)
  )
})

test('action output contract declares risk and confirmation lifecycle fields', () => {
  const output = getToolDefinition('task_flow', 'action').outputSchema

  for (const field of [
    'riskLevel',
    'riskReason',
    'requiresConfirmation',
    'executed',
    'confirmationId',
    'expiresAt',
    'affectedTargets',
    'resultStatus',
  ]) {
    assert.ok(output.properties[field], `操作输出缺少 ${field}`)
  }
})

test('business analysis discovery only exposes menu-permitted domains', () => {
  const [tool] = filterToolsForContext({
    endpointType: 'query',
    allowedMenuPaths: new Set(['/tasks']),
  }).filter((item) => item.name === 'business_analyze')

  assert.deepEqual(tool.inputSchema.properties.domain.enum, ['task'])
})

test('internal operation lookup rejects inherited object property names', () => {
  assert.throws(
    () => resolvePublicTool('task_manage', { operation: 'constructor' }, 'action'),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
  )
})

test('audit redaction removes confirmation and idempotency credentials', () => {
  assert.deepEqual(redactAuditInput({
    confirmation_id: 'ticket-secret',
    idempotency_key: 'retry-secret',
    project_id: 10,
  }), {
    confirmation_id: '[REDACTED]',
    idempotency_key: '[REDACTED]',
    project_id: 10,
  })
})

test('audit redaction also removes camelCase credentials', () => {
  assert.deepEqual(redactAuditInput({
    accessToken: 'token-secret',
    clientSecret: 'client-secret',
    confirmationId: 'ticket-secret',
    safeName: '项目A',
  }), {
    accessToken: '[REDACTED]',
    clientSecret: '[REDACTED]',
    confirmationId: '[REDACTED]',
    safeName: '项目A',
  })
})

test('MCP task search requests flat record pagination', () => {
  assert.deepEqual(buildTaskSearchInput({ page: 2, page_size: 10 }), {
    query: { page: 2, pageSize: 10, mcp_flat: '1' },
  })
})

test('direct project child searches return the unified pagination contract', async () => {
  const database = {
    prepare(sql) {
      if (/COUNT\(\*\)/.test(sql)) return { get: async () => ({ total: 21 }) }
      return { all: async () => [{ id: 1, status: 0 }] }
    },
  }
  for (const name of ['stage_plan_search', 'contract_search', 'payment_search']) {
    const result = await dispatchQueryTool(name, { page: 2, page_size: 10 }, {}, { database })
    assert.equal(result.items.length, 1, name)
    assert.equal(result.totalPages, 3, name)
    assert.equal(result.hasNextPage, true, name)
  }
})

test('preview rejects invalid related users before issuing a confirmation', async () => {
  const database = {
    prepare(sql) {
      if (/FROM pms_user/.test(sql)) return { get: async () => ({ count: 0 }) }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  await assert.rejects(
    () => dispatchActionTool('task_create', {
      name: '负责人不存在',
      source_type: 1,
      project_id: 10,
      task_type: 2,
      priority: 1,
      owner_ids: [999],
      expected_end_date: '2026-08-01',
      idempotency_key: 'invalid-owner',
      mode: 'preview',
    }, {
      user: { employeeNo: '005829', realName: '孙鑫鑫' },
    }, {
      database,
      loadTarget: async () => ({ type: 'task' }),
      ticketService: {
        createTicket: async () => {
          throw new Error('invalid preview must not create a ticket')
        },
      },
    }),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.owner_ids)
  )
})

test('file upload preview validates Base64 before issuing a confirmation', async () => {
  await assert.rejects(
    () => dispatchActionTool('stage_delivery_upload', {
      project_id: 10,
      item_id: 20,
      file_name: '交付.pdf',
      content_base64: 'not-base64',
      idempotency_key: 'invalid-file',
      mode: 'preview',
    }, {
      user: { employeeNo: '005829', realName: '孙鑫鑫' },
    }, {
      database: {},
      mergeArguments: async (_name, args) => args,
      loadTarget: async () => ({ type: 'stage_item' }),
      ticketService: {
        createTicket: async () => {
          throw new Error('invalid preview must not create a ticket')
        },
      },
    }),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.content_base64)
  )
})

test('preview response states that the operation is not executed and requires confirmation', async () => {
  const result = await dispatchActionTool('task_delete', {
    id: 59,
    mode: 'preview',
  }, {
    user: { employeeNo: '005829', realName: '孙鑫鑫' },
  }, {
    mergeArguments: async (_name, args) => args,
    validateBusinessRules: async () => {},
    loadTarget: async () => ({ type: 'task', id: 59, name: '任务59' }),
    ticketService: {
      createTicket: async (_context, _name, _args, preview) => ({
        confirmationId: 'ticket-59',
        expiresAt: '2026-07-29T10:00:00.000Z',
        preview,
        riskLevel: 'high',
      }),
    },
  })

  assert.equal(result.resultStatus, 'preview')
  assert.equal(result.executed, false)
  assert.equal(result.requiresConfirmation, true)
  assert.equal(result.riskLevel, 'high')
  assert.deepEqual(result.affectedTargets, [{ type: 'task', id: 59, name: '任务59' }])
})

test('audit result count uses the normalized items collection', () => {
  assert.equal(resultCount({ items: [{ id: 1 }, { id: 2 }] }), 2)
})

test('contract preview requires stage totals to equal the contract amount', async () => {
  await assert.rejects(
    () => validateActionBusinessRules('contract_create', {
      contract_amount: 100,
      stages: [
        { stage_name: '首款', planned_amount: 60 },
        { stage_name: '尾款', planned_amount: 30 },
      ],
    }, {}),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.stages)
  )
})

test('query output metadata explains business codes, money units and pagination completion', () => {
  const task = getToolDefinition('task_search', 'query').outputSchema
  assert.ok(task.properties.items.items.properties.priority_label)
  assert.ok(task.properties.items.items.properties.status_label)
  assert.ok(task.properties.hasNextPage)

  const contract = getToolDefinition('contract_search', 'query').outputSchema
  assert.match(contract.properties.items.items.properties.contract_amount.description, /元/)
})

test('action metadata publishes database-backed text limits and rejects invalid hours', () => {
  assert.equal(getToolDefinition('product_create', 'action').inputSchema.properties.name.maxLength, 100)
  assert.equal(getToolDefinition('task_create', 'action').inputSchema.properties.name.maxLength, 200)
  assert.equal(getToolDefinition('contract_create', 'action').inputSchema.properties.contract_code.maxLength, 100)
  assert.equal(getToolDefinition('contract_attachment_upload', 'action').inputSchema.properties.file_name.maxLength, 255)

  assert.throws(
    () => validateToolArguments(getToolDefinition('work_order_create', 'action'), {
      product_id: 1,
      problem_type: 2,
      problem_desc: '时间校验',
      follower_id: 3,
      urgency: 1,
      expected_resolve_date: '2026-07-31',
      submitter_name: '张三',
      submitter_dept: '研发部',
      submit_time: '2026-07-29T25:80:00+08:00',
      idempotency_key: 'invalid-hour',
    }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && Boolean(error.fieldErrors.submit_time)
  )
})

test('audit summary records the actual payment target and action risk', () => {
  assert.deepEqual(buildAuditSummary('payment_update', {
    project_id: 10,
    payment_id: 88,
  }, {
    riskLevel: 'high',
    affectedTargets: [{ type: 'payment', id: 88, name: '首付款' }],
    resultStatus: 'success',
  }), {
    module: '付款记录',
    targetId: 88,
    targetName: '首付款',
    riskLevel: 'high',
    resultCount: 1,
  })
})

test('preview rejects an inactive product before issuing a confirmation', async () => {
  const database = {
    prepare(sql) {
      if (/FROM pms_product/.test(sql)) return { get: async () => null }
      if (/FROM pms_user/.test(sql)) return { get: async () => ({ count: 1 }) }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  await assert.rejects(
    () => validateActionBusinessRules('project_create', {
      product_id: 404,
      owner_id: 8,
    }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.product_id)
  )
})

test('payment preview rejects a future month with a field-specific error', async () => {
  const nextYear = new Date().getFullYear() + 1
  await assert.rejects(
    () => validateActionBusinessRules('payment_create', {
      payment_month: `${nextYear}-01`,
    }, {}),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.payment_month)
  )
})

test('preview rejects duplicate task names before issuing a confirmation', async () => {
  const database = {
    prepare(sql) {
      if (/FROM pms_task WHERE name/.test(sql)) return { get: async () => ({ id: 66 }) }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  await assert.rejects(
    () => validateActionBusinessRules('task_create', { name: '重复任务' }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && error.fieldErrors.name === '任务名称已存在'
  )
})

test('preview rejects deleting a referenced product before issuing a confirmation', async () => {
  const database = {
    prepare(sql) {
      if (/project_count/.test(sql)) {
        return { get: async () => ({ project_count: 2, work_order_count: 0 }) }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  await assert.rejects(
    () => validateActionBusinessRules('product_delete', { id: 8 }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.id)
  )
})

test('execute consumes the confirmation ticket exactly once', async () => {
  let consumeCount = 0
  const result = await dispatchActionTool('task_update', {
    id: 59,
    name: '修订后的任务',
    mode: 'execute',
    confirmation_id: 'ticket-59',
    idempotency_key: 'execute-once',
  }, {
    user: { employeeNo: '005829', realName: '孙鑫鑫' },
  }, {
    actions: {
      task_update: [
        async (_req, res) => res.json({ code: 0, data: { id: 59 } }),
        (args) => ({ params: { id: args.id }, body: { name: args.name } }),
      ],
    },
    mergeArguments: async (_name, args) => args,
    validateBusinessRules: async () => {},
    loadTarget: async () => ({ type: 'task', id: 59, name: '任务59' }),
    ticketService: {
      consumeTicket: async () => { consumeCount += 1 },
      markTicketFailed: async () => {},
    },
  })

  assert.equal(consumeCount, 1)
  assert.equal(result.executed, true)
})

test('payment update validates amount against the record own stage', async () => {
  let receivedParams
  const database = {
    prepare(sql) {
      assert.match(sql, /SELECT stage_id FROM pms_project_payment_record/)
      return {
        get: async (...params) => {
          receivedParams = params
          return { planned_amount: 100, paid_amount: 80 }
        },
      }
    },
  }
  await assert.rejects(
    () => validateActionBusinessRules('payment_update', {
      payment_id: 88,
      payment_amount: 30,
    }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.payment_amount)
  )
  assert.deepEqual(receivedParams, [88, 88, null, 88])
})

test('contract update preview rejects reducing a stage below its paid amount', async () => {
  const database = {
    prepare(sql) {
      if (/FROM pms_project_contract c/.test(sql) && /paid_amount/.test(sql)) {
        return {
          all: async () => [{
            contract_id: 9,
            id: 12,
            stage_name: '首付款',
            paid_amount: 80,
          }],
        }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  await assert.rejects(
    () => validateActionBusinessRules('contract_update', {
      project_id: 3,
      contract_amount: 60,
      stages: [{ id: 12, stage_name: '首付款', planned_amount: 60 }],
    }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && /不能小于已付金额/.test(error.fieldErrors.stages)
  )
})

test('contract attachment preview rejects the eleventh active attachment', async () => {
  const database = {
    prepare(sql) {
      assert.match(sql, /pms_project_contract_attachment/)
      return { get: async () => ({ count: 10 }) }
    },
  }
  await assert.rejects(
    () => validateActionBusinessRules('contract_attachment_upload', {
      project_id: 3,
      file_name: '补充协议.pdf',
      mime_type: 'application/pdf',
      content_base64: 'JVBERi0x',
    }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.file_name)
  )
})

test('delivery delete preview preserves the final required file of a completed item', async () => {
  const database = {
    prepare(sql) {
      assert.match(sql, /requires_delivery_file/)
      return {
        get: async () => ({
          status: 2,
          requires_delivery_file: 1,
          active_file_count: 1,
        }),
      }
    },
  }
  await assert.rejects(
    () => validateActionBusinessRules('stage_delivery_delete', {
      project_id: 3,
      item_id: 12,
      file_id: 99,
    }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && Boolean(error.fieldErrors.file_id)
  )
})
