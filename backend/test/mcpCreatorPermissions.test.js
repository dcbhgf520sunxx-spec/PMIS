const assert = require('node:assert/strict')
const test = require('node:test')
const { assertActionTargetOwnership, loadActionTargetSnapshot } = require('../src/mcp/actionTools')
const { getPublicToolDefinition, resolvePublicTool, getCommandDefinition } = require('../src/mcp/catalog')
const { validateToolArguments, validateToolPermission } = require('../src/mcp/dispatcher')

const context = { user: { id: 8 }, allowedMenuPaths: new Set(), allowedPermissionCodes: new Set() }
const mainTargets = [
  ['product', { owner_id: 6 }],
  ['project', { owner_id: 6 }],
  ['requirement', { owner_id: 6 }],
  ['task', { owner_ids: [6, 7] }],
  ['bug', { assignee_id: 6 }],
  ['work_order', { follower_id: 6 }],
]

for (const [type, responsibility] of mainTargets) {
  for (const operation of ['update', 'delete']) {
    const command = `${type}_${operation}`
    test(`${command}: creator can maintain their own record in preview and execute`, async () => {
      // Exercise the real snapshot projection, not a hand-built permission target.
      const target = await loadActionTargetSnapshot(command, { id: 9 }, {
        prepare: () => ({ get: async () => ({ id: 9, name: '本人创建', ...responsibility, creator_id: '8' }) }),
      })
      for (const mode of ['preview', 'execute']) {
        assert.doesNotThrow(() => assertActionTargetOwnership(target, context, mode, command))
        assert.throws(() => assertActionTargetOwnership(target, { ...context, user: { id: 10 } }, mode, command),
          { code: 'MCP_ACTION_NOT_RESPONSIBLE' })
        assert.doesNotThrow(() => assertActionTargetOwnership(target, { ...context, user: { id: 6 } }, mode, command))
        for (const creator_id of [null, undefined, 0, 'invalid']) {
          assert.throws(() => assertActionTargetOwnership({ ...target, current: { ...target.current, creator_id } },
            context, mode, command), { code: 'MCP_ACTION_NOT_RESPONSIBLE' })
        }
      }
    })

    test(`${command}: creator cannot bypass menu permission or supply creator identity`, () => {
      const name = `${type}_manage`
      const args = { mode: 'preview', operation, id: 9, ...(operation === 'update'
        ? { [type === 'work_order' ? 'problem_desc' : ['bug', 'requirement'].includes(type) ? 'title' : 'name']: '修改内容' } : {}) }
      const definition = getPublicToolDefinition(name, 'action')
      validateToolArguments(definition, args)
      const resolved = resolvePublicTool(name, args, 'action')
      assert.throws(() => validateToolPermission(getCommandDefinition(resolved.name, 'action'), resolved.args, context),
        { code: 'MCP_PERMISSION_DENIED' })
      assert.throws(() => validateToolArguments(definition, { ...args, creator_id: 8 }),
        { code: 'MCP_ARGUMENT_INVALID' })
    })
  }

  test(`${type}: creator status alone does not grant special operations or child creation`, () => {
    const target = { type, id: 9, current: { ...responsibility, creator_id: 8 } }
    const commands = [`${type}_change_status`, `${type}_change_priority`, `${type}_assign`,
      'business_attachment_upload', 'business_attachment_delete', 'task_create_subtask',
      'stage_create', 'stage_item_create', 'stage_item_batch_create', 'contract_create', 'payment_create']
    for (const command of commands) {
      for (const mode of ['preview', 'execute']) {
        assert.throws(() => assertActionTargetOwnership(target, context, mode, command),
          { code: 'MCP_ACTION_NOT_RESPONSIBLE' }, command)
      }
    }
  })

  test(`${type}: creator cannot use ordinary edit to reassign responsibility`, () => {
    const target = { type, id: 9, current: { ...responsibility, creator_id: 8 } }
    const field = Object.keys(responsibility)[0]
    for (const mode of ['preview', 'execute']) {
      assert.throws(() => assertActionTargetOwnership(target, context, mode, `${type}_update`,
        { [field]: field === 'owner_ids' ? [8] : 8 }), { code: 'MCP_ACTION_NOT_RESPONSIBLE' })
      assert.doesNotThrow(() => assertActionTargetOwnership(target, context, mode, `${type}_update`, responsibility))
    }
  })
}

test('creator allowance does not apply to stages, contracts, payments, ordering or files', () => {
  for (const type of ['stage', 'stage_item', 'contract', 'payment', 'contract_attachment', 'stage_delivery', 'stage_order']) {
    for (const operation of ['update', 'delete']) {
      assert.throws(() => assertActionTargetOwnership({ type, id: 9, current: { owner_id: 6, creator_id: 8 } },
        context, 'preview', `${type}_${operation}`), { code: 'MCP_ACTION_NOT_RESPONSIBLE' })
    }
  }
})

test('ordinary creation and follow-up permissions keep their existing ownership exceptions', () => {
  for (const [type] of mainTargets) {
    assert.doesNotThrow(() => assertActionTargetOwnership({ type, current: null }, context, 'preview', `${type}_create`))
  }
  assert.doesNotThrow(() => assertActionTargetOwnership({ type: 'follow_up_record', current: { creator_id: 6 } },
    context, 'preview', 'follow_up_record_update'))
})
