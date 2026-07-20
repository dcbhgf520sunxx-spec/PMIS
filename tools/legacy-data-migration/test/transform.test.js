const test = require('node:test')
const assert = require('node:assert/strict')

const {
  BUSINESS_ROLE_MENU_CODES,
  assertLegacySnapshot,
  buildLegacyTaskTypeCodeMap,
  parseMemberIds,
  resolveTargetTaskTypeId,
  shouldMigrateOperationLog,
  toShanghaiTimestamp,
} = require('../src/transform')

test('parseMemberIds splits, trims and deduplicates legacy project members', () => {
  assert.deepEqual(parseMemberIds('9, 12,11,9,16'), [9, 12, 11, 16])
  assert.deepEqual(parseMemberIds(''), [])
  assert.deepEqual(parseMemberIds(null), [])
})

test('parseMemberIds rejects malformed or non-positive member IDs', () => {
  assert.throws(() => parseMemberIds('9,abc'), /项目成员 ID 非法/)
  assert.throws(() => parseMemberIds('9,0'), /项目成员 ID 非法/)
})

test('toShanghaiTimestamp keeps a MySQL DATETIME wall clock in Asia Shanghai', () => {
  assert.equal(toShanghaiTimestamp('2026-07-09 08:53:00'), '2026-07-09T08:53:00+08:00')
  assert.equal(toShanghaiTimestamp(null), null)
})

test('business role receives only approved PMIS business menus', () => {
  assert.deepEqual(BUSINESS_ROLE_MENU_CODES, [
    'home',
    'product',
    'project',
    'requirement',
    'task',
    'bug',
    'work_order',
  ])
})

test('task types are mapped by stable archive code instead of conflicting legacy IDs', () => {
  const legacyCodeById = buildLegacyTaskTypeCodeMap([
    { id: 1, code: 'TT001', archive_type_code: 'task_type' },
    { id: 4, code: 'TT004', archive_type_code: 'task_type' },
    { id: 30, code: 'BT001', archive_type_code: 'bug_type' },
  ])
  assert.deepEqual([...legacyCodeById.entries()], [[1, 'TT001'], [4, 'TT004']])
  assert.equal(resolveTargetTaskTypeId(4, legacyCodeById, new Map([
    ['TT001', 7],
    ['TT004', 10],
  ])), 10)
  assert.throws(
    () => resolveTargetTaskTypeId(11, legacyCodeById, new Map()),
    /任务类型映射缺失/
  )
})

test('milestone operation history is discarded with milestone data', () => {
  assert.equal(shouldMigrateOperationLog({ module: '里程碑' }), false)
  assert.equal(shouldMigrateOperationLog({ module: '项目' }), true)
})

test('assertLegacySnapshot accepts the confirmed production counts', () => {
  assert.doesNotThrow(() => assertLegacySnapshot({
    pms_user: 20,
    pms_role: 2,
    pms_user_role: 21,
    pms_archive_type: 1,
    pms_archive: 11,
    pms_product: 5,
    pms_project: 10,
    pms_requirement: 37,
    pms_task: 31,
    pms_operation_log: 178,
    pms_milestone: 7,
    pms_mcp_audit_log: 643,
    pms_bug: 0,
    pms_work_order: 0,
  }))
})

test('assertLegacySnapshot stops when the source changes after precheck', () => {
  assert.throws(() => assertLegacySnapshot({
    pms_user: 20,
    pms_role: 2,
    pms_user_role: 21,
    pms_archive_type: 1,
    pms_archive: 11,
    pms_product: 5,
    pms_project: 10,
    pms_requirement: 38,
    pms_task: 31,
    pms_operation_log: 178,
    pms_milestone: 7,
    pms_mcp_audit_log: 643,
    pms_bug: 0,
    pms_work_order: 0,
  }), /源库数量与确认快照不一致.*pms_requirement/)
})
