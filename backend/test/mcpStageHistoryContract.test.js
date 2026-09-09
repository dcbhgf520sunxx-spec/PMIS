const assert = require('node:assert/strict')
const test = require('node:test')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const { getToolDefinition, resolvePublicTool } = require('../src/mcp/catalog')
const { buildProjectStagePlanHistory } = require('../src/services/projectStagePlanHistory')

test('公开阶段历史契约保留业务身份并拒绝把日志ID或文本冒充目标身份', () => {
  const resolved = resolvePublicTool('business_history', { domain: 'stage_plan', target_id: 7 }, 'query')
  assert.equal(resolved.name, 'stage_plan_history')
  const data = buildProjectStagePlanHistory([101, 202].map((id, index) => ({
    id: index + 1, target_id: id, target_name: '同名验收事项', action: '新增关键事项',
    created_at: '2026-09-08T02:00:00Z', operator: '测试',
  })), { projectId: 7 })
  const validator = new AjvJsonSchemaValidator().getValidator(getToolDefinition('business_history', 'query').outputSchema)
  assert.equal(validator({ data }).valid, true)
  assert.deepEqual(data.map(item => [item.id, item.target_id]), [[1, 101], [2, 202]])
  assert.equal(validator({ data: [{ ...data[0], target_id: '101' }] }).valid, false)
  assert.equal(validator({ data: [{ ...data[0], target_type: 'log' }] }).valid, false)
  assert.equal(validator({ data: [{ ...data[0], target_id: null }] }).valid, true)
  assert.equal(validator({ data: [{ id: 1, action: '其他业务既有历史' }] }).valid, true)
})
