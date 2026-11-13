const assert = require('node:assert/strict')
const test = require('node:test')
const { createLoginRateLimitService } = require('../src/services/loginRateLimitService')

function fixture() {
  let time = 1000
  return { service: createLoginRateLimitService({ now: () => time }), advance: ms => { time += ms } }
}

test('失败滚动窗口逐条过期，锁定期间重试不延长结束时间', () => {
  const f = fixture()
  for (let i = 0; i < 4; i++) f.service.begin('user:1').complete('failure')
  f.advance(10 * 60 * 1000)
  f.service.begin('user:1').complete('failure')
  assert.equal(f.service.begin('user:1').retryAfter, 900)
  f.advance(60 * 1000)
  assert.equal(f.service.begin('user:1').retryAfter, 840)
  f.advance(14 * 60 * 1000)
  f.service.begin('user:1').complete('failure')
  assert.equal(f.service.begin('user:1').retryAfter, 0)
})

test('不足5次的旧失败在15分钟边界释放，跨窗口剩余失败仍保留', () => {
  const f = fixture()
  for (let i = 0; i < 3; i++) f.service.begin('user:1').complete('failure')
  f.advance(10 * 60 * 1000)
  f.service.begin('user:1').complete('failure')
  f.advance(5 * 60 * 1000)
  for (let i = 0; i < 4; i++) {
    const attempt = f.service.begin('user:1')
    assert.equal(attempt.retryAfter, 0)
    attempt.complete('failure')
  }
  assert.equal(f.service.begin('user:1').retryAfter, 900)
})

test('同步预留限制并发，成功与异常释放预算，重复完成无副作用', () => {
  const f = fixture()
  const attempts = Array.from({ length: 5 }, () => f.service.begin('user:1'))
  assert.equal(f.service.begin('user:1').retryAfter, 1)
  attempts[0].complete('failure')
  attempts[1].complete('success')
  attempts[2].complete()
  attempts[2].complete('failure')
  for (let i = 0; i < 3; i++) f.service.begin('user:1').complete('failure')
  assert.equal(f.service.begin('user:1').retryAfter, 1)
  attempts[3].complete()
  attempts[4].complete()
  assert.equal(f.service.begin('user:1').retryAfter, 0)
})

test('缓存满时不逐出有效锁，过期后立即清理并恢复新账号', () => {
  const f = fixture()
  for (let i = 0; i < 5000; i++) f.service.begin(`user:${i}`).complete('failure')
  assert.equal(f.service.begin('new-user').retryAfter, 60)
  for (let i = 0; i < 4; i++) f.service.begin('user:0').complete('failure')
  assert.equal(f.service.begin('user:0').retryAfter, 900)
  f.advance(15 * 60 * 1000)
  assert.equal(f.service.begin('new-user').retryAfter, 0)
})

test('IP请求窗口到期和容量过期恢复，不依赖成功登录或后台定时器', () => {
  const f = fixture()
  for (let i = 0; i < 120; i++) assert.equal(f.service.takeRequest('ip-0'), 0)
  assert.equal(f.service.takeRequest('ip-0'), 60)
  for (let i = 1; i < 5000; i++) assert.equal(f.service.takeRequest(`ip-${i}`), 0)
  assert.equal(f.service.takeRequest('new-ip'), 60)
  f.advance(60000)
  assert.equal(f.service.takeRequest('new-ip'), 0)
  assert.equal(f.service.takeRequest('ip-0'), 0)
})

test('大量不存在账号不能占满真实用户的保护缓存', () => {
  const f = fixture()
  for (let i = 0; i < 5000; i++) f.service.begin(`unknown:${i}`, { knownAccount: false }).complete('failure')
  assert.equal(f.service.begin('another-unknown', { knownAccount: false }).retryAfter, 60)
  const realUser = f.service.begin('user:1')
  assert.equal(realUser.retryAfter, 0)
  realUser.complete('success')
})
