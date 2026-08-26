const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { appendSyncRecord, formatSyncRecordForDisplay } = require('../src/services/itopsSyncService')

test('每次同步都追加一条记录，保留同一来源数据的多次失败历史', async () => {
  const calls = []
  const tx = {
    prepare(sql) {
      calls.push(sql)
      return { run: async (...params) => { calls.push(params); return { lastInsertRowid: 9 } } }
    },
  }

  await appendSyncRecord(tx, {
    configId: 2,
    batchId: 7,
    sourceKey: 'I8-001',
    sourceType: '服务请求',
    targetType: 'work_order',
    targetId: 12,
    hash: 'abc',
    payload: { 单据编码: 'I8-001' },
    status: 'failed',
    error: '第一次失败',
  })

  assert.match(calls[0], /INSERT INTO pms_integration_sync_record/)
  assert.doesNotMatch(calls[0], /ON CONFLICT/)
  assert.equal(calls.length, 2)
})

test('历史 i8 成功同步记录只补一条来源历史且不伪造字段变化', () => {
  const migration = fs.readFileSync(path.join(__dirname,
    '../db/migrations/20260825_05_backfill_i8_sync_history.sql'), 'utf8')

  assert.match(migration, /INSERT INTO pms_op_log/)
  assert.match(migration, /'需求'::VARCHAR\(50\)/)
  assert.match(migration, /'运维工单'::VARCHAR\(50\)/)
  assert.match(migration, /ORDER BY target_type, target_id, synced_at ASC, id ASC/)
  assert.match(migration, /l\.action = 'i8同步新增'/)
  assert.match(migration, /WHERE NOT EXISTS/)
  assert.doesNotMatch(migration, /field_name/)
})

test('执行明细区分新增、更新、跳过，并说明需求优先级处理规则', () => {
  assert.deepEqual(formatSyncRecordForDisplay({
    sync_status: 'success', execution_action_code: 'created', target_type: 'requirement', target_priority: 0,
  }), {
    sync_status: 'success', execution_action_code: 'created', target_type: 'requirement', target_priority: 0,
    execution_action: '新增', processing_note: '新增需求，优先级按系统默认设为低',
  })

  assert.deepEqual(formatSyncRecordForDisplay({
    sync_status: 'success', execution_action_code: 'updated', target_type: 'requirement', target_priority: 1,
  }), {
    sync_status: 'success', execution_action_code: 'updated', target_type: 'requirement', target_priority: 1,
    execution_action: '更新', processing_note: '更新已有需求，保留原优先级中，未覆盖人工调整',
  })

  assert.deepEqual(formatSyncRecordForDisplay({
    sync_status: 'skipped', execution_action_code: 'skipped', target_type: 'requirement', target_priority: 1,
  }), {
    sync_status: 'skipped', execution_action_code: 'skipped', target_type: 'requirement', target_priority: 1,
    execution_action: '跳过', processing_note: '源数据无变化，本次未重复更新',
  })
})
