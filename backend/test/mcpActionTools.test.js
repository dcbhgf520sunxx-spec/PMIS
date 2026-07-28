const assert = require('node:assert/strict')
const test = require('node:test')

const {
  dispatchActionTool,
  loadActionTargetSnapshot,
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
