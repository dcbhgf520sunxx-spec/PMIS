const assert = require('node:assert/strict')
const test = require('node:test')

const { attachResponseHelpers, ok, fail, failField } = require('../src/utils/response')

function responseDouble(requestId = 'req-123') {
  return {
    locals: { requestId },
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
}

test('success response keeps the existing envelope and adds requestId', () => {
  const res = responseDouble()
  ok(res, { id: 1 }, '读取成功')
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { code: 0, message: '读取成功', data: { id: 1 }, requestId: 'req-123' })
})

test('failure response carries the requestId', () => {
  const res = responseDouble('req-456')
  fail(res, 400, 400, '参数错误')
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { code: 400, message: '参数错误', data: null, requestId: 'req-456' })
})

test('field failure uses the unified fieldErrors envelope', () => {
  const res = responseDouble('req-field')
  failField(res, 'problem_desc', '问题描述已存在')
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, {
    code: 400,
    message: '请检查表单字段',
    data: null,
    fieldErrors: { problem_desc: ['问题描述已存在'] },
    requestId: 'req-field'
  })
})

test('response helper middleware adds requestId to legacy envelopes', () => {
  const res = responseDouble('req-789')
  attachResponseHelpers({}, res, () => {})

  res.json({ code: 0, message: 'success', data: { id: 1 } })

  assert.deepEqual(res.body, { code: 0, message: 'success', data: { id: 1 }, requestId: 'req-789' })
})

test('response helper middleware exposes res.ok and res.fail', () => {
  const res = responseDouble('req-999')
  attachResponseHelpers({}, res, () => {})

  res.ok({ saved: true }, '已保存')
  assert.deepEqual(res.body, { code: 0, message: '已保存', data: { saved: true }, requestId: 'req-999' })

  const failed = responseDouble('req-998')
  attachResponseHelpers({}, failed, () => {})
  failed.fail(422, 422, '校验失败')
  assert.equal(failed.statusCode, 422)
  assert.deepEqual(failed.body, { code: 422, message: '校验失败', data: null, requestId: 'req-998' })
})
