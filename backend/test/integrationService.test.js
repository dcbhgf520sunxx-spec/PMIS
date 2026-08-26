const test = require('node:test')
const assert = require('node:assert/strict')

const {
  isIntegrationDue,
  resolveIntegrationAdapter,
} = require('../src/services/integrationService')

test('只有已启用自动执行、到达首次执行时间且达到配置间隔的接口才会到期', () => {
  const now = new Date('2026-08-24T12:00:00+08:00')
  const base = { enabled: 1, auto_enabled: 1, auto_start_at: '2026-08-24T08:00:00+08:00', sync_interval_hours: 3 }
  assert.equal(isIntegrationDue({ ...base, auto_start_at: null, last_auto_started_at: null }, now), false)
  assert.equal(isIntegrationDue({ ...base, auto_start_at: '2026-08-24T12:00:01+08:00', last_auto_started_at: null }, now), false)
  assert.equal(isIntegrationDue({ ...base, last_auto_started_at: null }, now), true)
  assert.equal(isIntegrationDue({ ...base, enabled: 0, last_auto_started_at: null }, now), false)
  assert.equal(isIntegrationDue({ ...base, auto_enabled: 0, last_auto_started_at: null }, now), false)
  assert.equal(isIntegrationDue({ ...base, last_auto_started_at: '2026-08-24T10:00:01+08:00' }, now), false)
  assert.equal(isIntegrationDue({ ...base, last_auto_started_at: '2026-08-24T09:00:00+08:00' }, now), true)
})

test('手动同步不会顺延下一次自动执行', () => {
  const now = new Date('2026-08-24T12:00:00+08:00')
  const config = {
    enabled: 1,
    auto_enabled: 1,
    auto_start_at: '2026-08-24T08:00:00+08:00',
    sync_interval_hours: 3,
    last_started_at: '2026-08-24T11:59:00+08:00',
    last_auto_started_at: '2026-08-24T09:00:00+08:00',
  }

  assert.equal(isIntegrationDue(config, now), true)
})

test('接口按 adapter_code 选择内置适配器，未知适配器返回明确错误', () => {
  const adapter = resolveIntegrationAdapter({ adapter_code: 'i8_it_operations' })
  assert.equal(typeof adapter.sync, 'function')
  assert.equal(typeof adapter.testConnection, 'function')
  assert.throws(
    () => resolveIntegrationAdapter({ adapter_code: 'unknown_adapter' }),
    /暂不支持的接口适配器：unknown_adapter/,
  )
})
