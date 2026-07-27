const assert = require('node:assert/strict')
const test = require('node:test')

const { requiresPasswordChange } = require('../src/middleware/auth')

test('密码登录的首次登录用户仍被业务接口拦截', () => {
  assert.equal(requiresPasswordChange({
    decoded: { authMethod: 'password' },
    user: { first_login: 1 },
    requestPath: '/api/projects'
  }), true)
})

test('企微单点登录跳过首次改密且不改变数据库标记', () => {
  assert.equal(requiresPasswordChange({
    decoded: { authMethod: 'wecom' },
    user: { first_login: 1 },
    requestPath: '/api/projects'
  }), false)
})

test('旧密码令牌继续遵循现有首次改密规则', () => {
  assert.equal(requiresPasswordChange({
    decoded: {},
    user: { first_login: 1 },
    requestPath: '/api/projects'
  }), true)
})

test('首次改密允许路径不被密码登录策略拦截', () => {
  assert.equal(requiresPasswordChange({
    decoded: { authMethod: 'password' },
    user: { first_login: 1 },
    requestPath: '/api/auth/password'
  }), false)
})
