const assert = require('node:assert/strict')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const { createAuthSessionService } = require('../src/services/authSessionService')

function createDb() {
  const home = { id: 1, parent_id: 0, code: 'home', path: '/home', sort_order: 1 }
  const projects = { id: 2, parent_id: 0, code: 'projects', path: '/projects', sort_order: 2 }
  return {
    prepare(sql) {
      if (sql.includes('INNER JOIN pms_role_menu')) {
        return { async all() { return [projects] } }
      }
      if (sql.includes("path = '/home'")) {
        return { async get() { return home } }
      }
      if (sql.includes('SELECT * FROM pms_menu')) {
        return { async all() { return [home, projects] } }
      }
      if (sql.includes('SELECT r.code')) {
        return { async all() { return [{ code: 'employee' }] } }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }
}

const user = {
  id: 8,
  employee_no: 'EMP001',
  real_name: '测试用户',
  phone: '13800000000',
  avatar_url: null,
  first_login: 1
}

test('企微会话复用现有菜单角色并在令牌中标记登录方式', async () => {
  const service = createAuthSessionService({
    db: createDb(),
    accessLogService: {
      async recordLoginSuccess() {
        return 'session-wecom'
      }
    },
    jwtSecret: 'test-secret'
  })

  const result = await service.createSession({
    user,
    account: 'EMP001',
    req: { headers: {} },
    authMethod: 'wecom'
  })
  const claims = jwt.verify(result.token, 'test-secret')

  assert.equal(result.first_login, 0)
  assert.equal(result.access_session_id, 'session-wecom')
  assert.deepEqual(result.user.roles, ['employee'])
  assert.deepEqual(result.menus.map((menu) => menu.path), ['/home', '/projects'])
  assert.equal(claims.userId, 8)
  assert.equal(claims.employeeNo, 'EMP001')
  assert.equal(claims.sessionId, 'session-wecom')
  assert.equal(claims.authMethod, 'wecom')
})

test('密码会话继续返回数据库首次登录标记', async () => {
  const service = createAuthSessionService({
    db: createDb(),
    accessLogService: {
      async recordLoginSuccess() {
        return 'session-password'
      }
    },
    jwtSecret: 'test-secret'
  })

  const result = await service.createSession({
    user,
    account: 'EMP001',
    req: { headers: {} },
    authMethod: 'password'
  })

  assert.equal(result.first_login, 1)
  assert.equal(jwt.verify(result.token, 'test-secret').authMethod, 'password')
})
