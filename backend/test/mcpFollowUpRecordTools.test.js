const assert = require('node:assert/strict')
const test = require('node:test')

const { dispatchActionTool } = require('../src/mcp/actionTools')
const { dispatchQueryTool } = require('../src/mcp/queryTools')

const context = {
  client: { id: 3 },
  user: { id: 8, employeeNo: '005829', realName: '孙鑫鑫' },
  requestId: 'follow-up-test',
  ip: '127.0.0.1',
}

test('跟进记录查询按对象返回真实记录和登录用户姓名', async () => {
  const database = {
    prepare(sql) {
      if (sql.includes('SELECT id, title AS name FROM pms_requirement')) {
        return { async get() { return { id: 12, name: '接口自动化' } } }
      }
      if (sql.includes('FROM pms_follow_up_record f')) {
        return { async all() { return [{
          id: 31,
          content: '本周已完成联调',
          creator_id: 8,
          creator_name: '孙鑫鑫',
          updater_id: 8,
          updater_name: '孙鑫鑫',
          created_at: '2026-08-25T10:00:00.000Z',
          updated_at: '2026-08-25T10:00:00.000Z',
        }] } }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  const result = await dispatchQueryTool('follow_up_record_list', {
    target_type: 'requirement',
    target_id: 12,
  }, context, { database })

  assert.deepEqual(result, [{
    id: 31,
    content: '本周已完成联调',
    creator_id: 8,
    creator_name: '孙鑫鑫',
    updater_id: 8,
    updater_name: '孙鑫鑫',
    created_at: '2026-08-25T10:00:00.000Z',
    updated_at: '2026-08-25T10:00:00.000Z',
  }])
})

test('跟进记录写操作不受负责人限制但仍创建确认票据', async () => {
  let ticketCreated = false
  const result = await dispatchActionTool('follow_up_record_update', {
    target_type: 'project',
    target_id: 9,
    follow_up_id: 31,
    content: '已完成评审',
    mode: 'preview',
  }, context, {
    actions: {
      follow_up_record_update: [async () => {}, () => ({ body: {} })],
    },
    mergeArguments: async (_name, args) => args,
    validateStatus: async () => {},
    validateBusinessRules: async () => {},
    loadTarget: async () => ({
      type: 'follow_up_record',
      id: 31,
      name: '项目管理系统',
      current: { target_type: 'project', target_id: 9, content: '评审中', owner_id: 6 },
    }),
    ticketService: {
      async createTicket() {
        ticketCreated = true
        return { confirmationId: 'follow-up-ticket' }
      },
    },
  })

  assert.equal(ticketCreated, true)
  assert.equal(result.confirmationId, 'follow-up-ticket')
})
