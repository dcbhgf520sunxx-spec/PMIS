const assert = require('node:assert/strict')
const test = require('node:test')
const { execFileSync } = require('node:child_process')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '../..')
const controllersDir = join(root, 'backend/src/controllers')
const controllerSources = readdirSync(controllersDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, source: readFileSync(join(controllersDir, name), 'utf8') }))

test('业务控制器禁止直接写 pms_op_log 或循环调用单条 writeLog', () => {
  const violations = controllerSources.flatMap(({ name, source }) => {
    const reasons = []
    if (/INSERT INTO pms_op_log/i.test(source)) reasons.push('直接 INSERT pms_op_log')
    if (/for\s*\(const\s+\w+\s+of\s+changes\)\s*\{[\s\S]{0,300}?\.writeLog\(/.test(source)) reasons.push('循环调用 writeLog')
    return reasons.map((reason) => `${name}: ${reason}`)
  })
  assert.deepEqual(violations, [], violations.join('\n'))
})

test('查询字段级操作日志的接口必须按操作标识聚合并提供详情字段顺序', () => {
  const violations = controllerSources
    .filter(({ source }) => /FROM pms_op_log/i.test(source) && /field_name/i.test(source))
    .filter(({ source }) => !/groupOperationLogs\(logs,\s*DETAIL_FIELD_ORDER\)/.test(source))
    .map(({ name }) => name)
  assert.deepEqual(violations, [], `缺少 groupOperationLogs(logs, DETAIL_FIELD_ORDER): ${violations.join(', ')}`)
})

test('操作日志结构在初始化 SQL、migration、Markdown 和 Excel 中保持同步', () => {
  const init = readFileSync(join(root, 'backend/db/init/001_schema.sql'), 'utf8')
  const migration = readFileSync(join(root, 'backend/db/migrations/20260712_add_operation_log_group.sql'), 'utf8')
  const markdown = readFileSync(join(root, 'docs/数据库表结构.md'), 'utf8')
  const workbookXml = execFileSync('unzip', ['-p', join(root, 'docs/数据库表结构.xlsx')], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 })
  for (const [name, source] of Object.entries({ init, migration, markdown, workbookXml })) {
    assert.match(source, /operation_id/, `${name} 缺少 operation_id`)
  }
})
