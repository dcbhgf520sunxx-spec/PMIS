const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')

const script = join(__dirname, '../scripts/audit-operation-history.js')

function runAudit(source) {
  const controllersDir = mkdtempSync(join(tmpdir(), 'history-audit-'))
  writeFileSync(join(controllersDir, 'taskController.js'), source)
  const result = spawnSync(process.execPath, [script, '--controllers-dir', controllersDir], { encoding: 'utf8' })
  rmSync(controllersDir, { recursive: true, force: true })
  return result
}

test('历史门禁阻断聚合后直接返回数据库原始字段和值', () => {
  const result = runAudit(`
    const { groupOperationLogs } = require('../utils/operationHistory')
    exports.history = async (_req, res) => {
      const logs = await db.prepare('SELECT field_name, old_value, new_value FROM pms_op_log').all()
      ok(res, groupOperationLogs(logs, DETAIL_FIELD_ORDER))
    }
  `)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /必须转成中文字段名和业务展示值/)
})

test('历史门禁允许使用统一转译能力', () => {
  const result = runAudit(`
    const { formatHistoryChanges, groupOperationLogs } = require('../utils/operationHistory')
    exports.history = async (_req, res) => {
      const logs = await db.prepare('SELECT field_name, old_value, new_value FROM pms_op_log').all()
      ok(res, groupOperationLogs(logs, DETAIL_FIELD_ORDER).map((group) => ({
        ...group,
        changes: formatHistoryChanges(group.changes, {
          fieldLabels: { owner_id: '负责人' },
          valueLookups: { owner_id: userLookup }
        })
      })))
    }
  `)
  assert.equal(result.status, 0, result.stdout)
})

test('历史门禁阻断只调用转译函数但不声明字段和值映射', () => {
  const result = runAudit(`
    exports.history = async (_req, res) => {
      const grouped = groupOperationLogs(logs, DETAIL_FIELD_ORDER)
      ok(res, grouped.map((group) => ({ ...group, changes: formatHistoryChanges(group.changes) })))
    }
  `)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /必须转成中文字段名和业务展示值/)
})

test('历史门禁兼容已经显式完成字段和值转译的旧实现', () => {
  const result = runAudit(`
    const FIELD_LABEL = { owner_id: '负责人' }
    function resolveValue(field, value) { return field === 'owner_id' ? userMap.get(value) : value }
    exports.history = async (_req, res) => {
      const grouped = groupOperationLogs(logs, DETAIL_FIELD_ORDER)
      const details = grouped.flatMap((group) => group.changes.map((change) => ({
        field: FIELD_LABEL[change.field_name],
        oldVal: resolveValue(change.field_name, change.old_value),
        newVal: resolveValue(change.field_name, change.new_value)
      })))
      ok(res, details)
    }
  `)
  assert.equal(result.status, 0, result.stdout)
})
