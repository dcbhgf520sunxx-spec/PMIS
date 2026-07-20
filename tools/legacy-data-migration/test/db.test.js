const test = require('node:test')
const assert = require('node:assert/strict')

const { insertRows, quoteIdentifier } = require('../src/db')

test('quoteIdentifier accepts only fixed SQL identifiers', () => {
  assert.equal(quoteIdentifier('pms_user'), '"pms_user"')
  assert.throws(() => quoteIdentifier('pms_user; DROP TABLE pms_user'), /SQL 标识符非法/)
})

test('insertRows uses parameterized PostgreSQL statements', async () => {
  const calls = []
  const client = { query: async (sql, params) => calls.push({ sql, params }) }

  await insertRows(client, 'pms_project_member', ['project_id', 'user_id'], [
    { project_id: 10, user_id: 2 },
    { project_id: 10, user_id: 3 },
  ])

  assert.deepEqual(calls, [
    {
      sql: 'INSERT INTO "pms_project_member" ("project_id", "user_id") VALUES ($1, $2)',
      params: [10, 2],
    },
    {
      sql: 'INSERT INTO "pms_project_member" ("project_id", "user_id") VALUES ($1, $2)',
      params: [10, 3],
    },
  ])
})
