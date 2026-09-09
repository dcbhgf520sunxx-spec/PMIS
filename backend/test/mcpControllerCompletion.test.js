const test = require('node:test')
const assert = require('node:assert/strict')
const { invokeController } = require('../src/mcp/controllerAdapter')

const context = { user: { id: 1, employeeNo: 'TEST' }, requestId: 'test' }

test('MCP waits for controller transaction completion after a response is prepared', async () => {
  let releaseCommit
  let settled = false
  const commit = new Promise(resolve => { releaseCommit = resolve })
  const result = invokeController(async (_req, res) => {
    res.json({ code: 0, data: { id: 1 } })
    await commit
  }, context).then(value => { settled = true; return value })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false)
  releaseCommit()
  assert.deepEqual(await result, { code: 0, data: { id: 1 }, requestId: 'test' })
})

test('commit failure after res.json rejects instead of returning a false success', async () => {
  await assert.rejects(invokeController(async (_req, res) => {
    res.json({ code: 0 })
    await Promise.resolve()
    throw new Error('commit failed')
  }, context), /commit failed/)
})

test('controllers without response and synchronous exceptions still reject', async () => {
  await assert.rejects(invokeController(async () => {}, context), /未返回结果/)
  await assert.rejects(invokeController(() => { throw new Error('sync failed') }, context), /sync failed/)
  assert.equal(await invokeController((_req, res) => res.send('ready'), context), 'ready')
})
