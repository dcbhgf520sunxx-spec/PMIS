const assert = require('node:assert/strict')
const test = require('node:test')
const { createLoginCaptchaService } = require('../src/services/loginCaptchaService')

function fixture() {
  let time = 1000
  let answer
  const service = createLoginCaptchaService({
    now: () => time,
    renderImage: (text) => {
      answer = text
      return '<svg><path d="M1 1"/></svg>'
    }
  })
  return { service, answer: () => answer, advance: (ms) => { time += ms } }
}

test('验证码答案不公开，忽略大小写且只能消费一次', () => {
  const f = fixture()
  const captcha = f.service.issue('client-a')
  assert.match(f.answer(), /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/)
  assert.deepEqual(Object.keys(captcha).sort(), ['captcha_id', 'expires_in', 'image'])
  assert.equal(captcha.expires_in, 120)
  assert.equal(f.service.consume('client-a', captcha.captcha_id, f.answer().toLowerCase()), true)
  assert.equal(f.service.consume('client-a', captcha.captcha_id, f.answer()), false)
})

test('错误答案同样销毁验证码，不能反复猜测', () => {
  const f = fixture()
  const captcha = f.service.issue('client-a')
  const answer = f.answer()
  assert.equal(f.service.consume('client-a', captcha.captcha_id, 'wrong'), false)
  assert.equal(f.service.consume('client-a', captcha.captcha_id, answer), false)
})

test('2分钟边界过期，其他客户端不能消费', () => {
  const f = fixture()
  const first = f.service.issue('client-a')
  assert.equal(f.service.consume('client-b', first.captcha_id, f.answer()), false)
  const second = f.service.issue('client-a')
  f.advance(120000)
  assert.equal(f.service.consume('client-a', second.captcha_id, f.answer()), false)
})

test('缺失和非字符串参数安全拒绝', () => {
  const f = fixture()
  for (const value of [undefined, null, {}, [], 123]) {
    assert.equal(f.service.consume('client-a', value, value), false)
  }
})

test('共享出口可集中获取验证码，高频超限后在分钟窗口到期恢复', () => {
  const f = fixture()
  for (let i = 0; i < 300; i++) f.service.issue('client-a')
  assert.throws(() => f.service.issue('client-a'), { statusCode: 429 })
  f.advance(60000)
  assert.ok(f.service.issue('client-a').captcha_id)
})

test('全局缓存有上限，过期清理后恢复签发', () => {
  const f = fixture()
  for (let i = 0; i < 5000; i++) f.service.issue(`client-${i}`)
  assert.throws(() => f.service.issue('next-client'), { statusCode: 429 })
  f.advance(120000)
  assert.ok(f.service.issue('next-client').captcha_id)
})

test('验证码只返回PNG像素，不暴露可直接匹配答案的SVG字形路径', () => {
  const service = createLoginCaptchaService()
  const result = service.issue('client-a')
  assert.match(result.image, /^data:image\/png;base64,/)
  const png = Buffer.from(result.image.split(',')[1], 'base64')
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(png.readUInt32BE(16), 150)
  assert.equal(png.readUInt32BE(20), 44)
  assert.doesNotMatch(png.toString(), /<svg|<path|<text|data-answer/i)
})
