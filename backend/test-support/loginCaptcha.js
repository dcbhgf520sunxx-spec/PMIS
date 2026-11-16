const assert = require('node:assert/strict')
const captchaModule = require('../src/services/loginCaptchaService')

// 只在测试进程的图片渲染边界读取答案，不向生产接口增加测试后门。
function captureLoginCaptcha(t) {
  let answer
  const createService = captchaModule.createLoginCaptchaService
  t.mock.method(captchaModule, 'createLoginCaptchaService', () => createService({
    renderImage(text) {
      answer = text
      return captchaModule.renderCaptchaImage(text)
    }
  }))
  return async (origin) => {
    const response = await fetch(`${origin}/api/auth/captcha`)
    assert.equal(response.status, 200)
    const result = await response.json()
    return { captcha_id: result.data.captcha_id, captcha_code: answer }
  }
}

module.exports = { captureLoginCaptcha }
