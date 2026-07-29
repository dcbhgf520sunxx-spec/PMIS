const assert = require('node:assert/strict')
const test = require('node:test')

const { analyzeBusinessData } = require('../src/services/mcpAnalysisService')
const { searchBusinessOptions } = require('../src/mcp/queryTools')
const { buildRequirementWhere } = require('../src/controllers/requirementController')

test('business options return active users without exposing account credentials', async () => {
  const calls = []
  const database = {
    prepare(sql) {
      calls.push(sql)
      return {
        get: async () => ({ total: 1 }),
        all: async () => [{ id: 8, name: '孙鑫鑫' }],
      }
    },
  }

  const result = await searchBusinessOptions({ option_type: 'user', keyword: '孙', page: 1, page_size: 20 }, database)
  assert.deepEqual(result, {
    optionType: 'user',
    items: [{ id: 8, name: '孙鑫鑫', displayName: '孙鑫鑫' }],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  assert.match(calls.join('\n'), /status = 1/)
  assert.doesNotMatch(calls.join('\n'), /password|employee_no|phone/i)
})

test('business options reject unsupported option types with a field error', async () => {
  await assert.rejects(
    () => searchBusinessOptions({ option_type: 'role' }, {}),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && error.fieldErrors.option_type === '不支持的业务选项类型：role'
  )
})

test('contract amount analysis sums contract amounts', async () => {
  let capturedSql = ''
  const database = {
    prepare(sql) {
      capturedSql = sql
      return { all: async () => [{ value: '300000.00' }] }
    },
  }
  const result = await analyzeBusinessData({
    domain: 'contract',
    metric: 'amount_sum',
  }, database)
  assert.match(capturedSql, /SUM\(contract_amount\)/)
  assert.equal(result.results[0].value, '300000.00')
})

test('invalid analysis combinations return exact machine-readable field errors', async () => {
  await assert.rejects(
    () => analyzeBusinessData({ domain: 'bug', metric: 'overdue_count' }, {}),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && error.fieldErrors.metric === 'BUG不支持逾期数量统计'
  )
  await assert.rejects(
    () => analyzeBusinessData({ domain: 'work_order', metric: 'count', status: 3 }, {}),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && error.fieldErrors.status === '工单状态可选值为：0、1、2、4、5'
  )
})

test('requirement status zero is retained as a real query filter', () => {
  assert.deepEqual(buildRequirementWhere({ status: 0 }), {
    sql: ' WHERE r.is_deleted=0 AND r.status IN (?)',
    params: [0],
  })
})
