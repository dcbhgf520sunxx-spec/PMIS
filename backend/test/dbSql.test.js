const assert = require('node:assert/strict')
const test = require('node:test')

const { toPostgresSql } = require('../src/dbSql')

test('converts positional placeholders to postgres placeholders', () => {
  const sql = 'SELECT * FROM pms_user WHERE employee_no = ? AND status = ? AND is_deleted = 0'

  assert.equal(
    toPostgresSql(sql),
    'SELECT * FROM pms_user WHERE employee_no = $1 AND status = $2 AND is_deleted = 0'
  )
})

test('keeps question marks inside quoted strings unchanged', () => {
  const sql = "SELECT '?' as literal, name FROM pms_role WHERE code LIKE ?"

  assert.equal(
    toPostgresSql(sql),
    "SELECT '?' as literal, name FROM pms_role WHERE code LIKE $1"
  )
})
