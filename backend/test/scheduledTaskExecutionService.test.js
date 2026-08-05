const test = require('node:test')
const assert = require('node:assert/strict')

const { executeOnce } = require('../src/services/scheduledTaskExecutionService')

function createDatabase(initialRow = null) {
  const state = { row: initialRow ? { ...initialRow } : null }
  return {
    state,
    prepare(sql) {
      return {
        async get() { return state.row ? { id: state.row.id, status: state.row.status } : undefined },
        async run(...params) {
          if (sql.includes('INSERT INTO pms_scheduled_task_execution')) {
            if (state.row) return { lastInsertRowid: undefined, changes: 0 }
            state.row = { id: 1, status: 'running', attempt_count: 1 }
            return { lastInsertRowid: 1, changes: 1 }
          }
          if (sql.includes("SET status = 'running'")) {
            if (state.row?.status !== 'failed') return { changes: 0 }
            state.row.status = 'running'
            state.row.attempt_count += 1
            return { changes: 1 }
          }
          if (sql.includes("SET status = 'success'")) {
            state.row.status = 'success'
            state.row.result_data = params[0]
            return { changes: 1 }
          }
          if (sql.includes("SET status = 'failed'")) {
            state.row.status = 'failed'
            state.row.error_message = params[0]
            return { changes: 1 }
          }
          throw new Error(`未处理的 SQL：${sql}`)
        },
      }
    },
  }
}

const identity = { taskCode: 'task', targetType: 'contract', targetId: 1, executionKey: 'before:30' }

test('通用定时任务执行记录保证成功节点不重复执行', async () => {
  const database = createDatabase()
  let calls = 0
  assert.equal((await executeOnce(identity, async () => { calls += 1; return { ok: true } }, database)).executed, true)
  assert.equal((await executeOnce(identity, async () => { calls += 1 }, database)).executed, false)
  assert.equal(calls, 1)
  assert.equal(database.state.row.status, 'success')
})

test('通用定时任务执行记录允许失败后重试并累计次数', async () => {
  const database = createDatabase({ id: 8, status: 'failed', attempt_count: 1 })
  const outcome = await executeOnce(identity, async () => ({ retried: true }), database)
  assert.equal(outcome.executed, true)
  assert.equal(database.state.row.attempt_count, 2)
  assert.equal(database.state.row.status, 'success')
})
