// 浏览器测试进程固定随机边界，生产启动入口仍为 src/server.js。
if (process.env.NODE_ENV !== 'test' || process.env.INTEGRATION_DB_ISOLATED !== '1') {
  throw new Error('浏览器测试服务只能连接明确标记的隔离测试环境')
}

const { mock } = require('node:test')
const crypto = require('node:crypto')
const randomInt = mock.method(crypto, 'randomInt', () => 0)
try {
  require('../src/services/loginCaptchaService')
} finally {
  randomInt.mock.restore()
}
require('../src/server')
