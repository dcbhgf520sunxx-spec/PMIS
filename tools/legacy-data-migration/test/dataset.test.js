const test = require('node:test')
const assert = require('node:assert/strict')

const { transformLegacyDataset } = require('../src/dataset')

test('transformLegacyDataset builds project members, remaps task types and drops milestone logs', () => {
  const source = {
    archives: [
      { id: 1, code: 'TT001', name: '需求', archive_type_code: 'task_type', sort_order: 1, status: 1, creator_id: 1, updater_id: 1, is_deleted: 0, created_at: '2026-07-01 08:00:00', updated_at: '2026-07-01 08:00:00' },
    ],
    projects: [
      { id: 10, member_ids: '2, 3,2', created_at: '2026-07-01 08:00:00', updated_at: '2026-07-02 09:00:00' },
    ],
    tasks: [
      { id: 20, task_type: 1, created_at: '2026-07-03 10:00:00', updated_at: '2026-07-04 11:00:00' },
    ],
    operationLogs: [
      { id: 30, module: '任务', created_at: '2026-07-05 12:00:00' },
      { id: 31, module: '里程碑', created_at: '2026-07-05 13:00:00' },
    ],
  }

  const result = transformLegacyDataset(source, new Map([['TT001', 7]]))

  assert.deepEqual(result.projectMembers, [
    { project_id: 10, user_id: 2 },
    { project_id: 10, user_id: 3 },
  ])
  assert.equal(result.tasks[0].task_type, 7)
  assert.equal(result.tasks[0].created_at, '2026-07-03T10:00:00+08:00')
  assert.deepEqual(result.operationLogs.map((row) => row.id), [30])
  assert.equal(result.operationLogs[0].created_at, '2026-07-05T12:00:00+08:00')
})

test('transformLegacyDataset fills missing user-role creation time from the related user', () => {
  const result = transformLegacyDataset({
    users: [{ id: 2, created_at: '2026-07-01 08:00:00', updated_at: '2026-07-01 08:00:00' }],
    userRoles: [{ id: 5, user_id: 2, role_id: 2, created_at: null }],
  }, new Map())

  assert.equal(result.userRoles[0].created_at, '2026-07-01T08:00:00+08:00')
})
