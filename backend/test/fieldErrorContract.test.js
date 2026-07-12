const assert = require('node:assert/strict')
const test = require('node:test')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

test('明确归属字段的已存在校验不得返回普通全局错误', () => {
  const controllersDir = join(__dirname, '../src/controllers')
  const violations = readdirSync(controllersDir)
    .filter((name) => name.endsWith('.js'))
    .flatMap((name) => {
      const source = readFileSync(join(controllersDir, name), 'utf8')
      return source.split('\n').flatMap((line, index) =>
        /(?:fail\(res|res\.status\(400\)\.json).*['"][^'"]*(?:工号|手机号|编码前缀)已存在/.test(line)
          ? [`${name}:${index + 1}`]
          : []
      )
    })

  assert.deepEqual(violations, [], `请使用 failField 返回字段错误：${violations.join(', ')}`)
})
