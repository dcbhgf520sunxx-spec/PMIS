const { Pool, types } = require('pg')
const { toPostgresSql, withReturningId } = require('./dbSql')
require('./config/loadEnv')

const DB_TIMEZONE = process.env.DB_TIMEZONE || 'Asia/Shanghai'

types.setTypeParser(1082, (value) => value)
types.setTypeParser(1114, (value) => value)
types.setTypeParser(1184, (value) => value)

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'pms',
  password: process.env.DB_PASSWORD || 'pms123456',
  database: process.env.DB_NAME || 'pmis',
  max: Number(process.env.DB_POOL_MAX || 10),
  options: process.env.DB_OPTIONS || `-c timezone=${DB_TIMEZONE}`,
})

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0]
  return params
}

function prepare(sql) {
  return {
    get: async (...params) => {
      const result = await pool.query(toPostgresSql(sql), normalizeParams(params))
      return result.rows[0]
    },
    all: async (...params) => {
      const result = await pool.query(toPostgresSql(sql), normalizeParams(params))
      return result.rows
    },
    run: async (...params) => {
      const result = await pool.query(toPostgresSql(withReturningId(sql)), normalizeParams(params))
      return {
        lastInsertRowid: result.rows[0]?.id,
        changes: result.rowCount,
      }
    },
  }
}

async function exec(sql, params = []) {
  return pool.query(toPostgresSql(sql), params)
}

async function transaction(fn) {
  const client = await pool.connect()
  const tx = {
    query: (sql, params = []) => client.query(toPostgresSql(sql), params),
    prepare: (sql) => ({
      get: async (...params) => {
        const result = await client.query(toPostgresSql(sql), normalizeParams(params))
        return result.rows[0]
      },
      all: async (...params) => {
        const result = await client.query(toPostgresSql(sql), normalizeParams(params))
        return result.rows
      },
      run: async (...params) => {
        const result = await client.query(toPostgresSql(withReturningId(sql)), normalizeParams(params))
        return {
          lastInsertRowid: result.rows[0]?.id,
          changes: result.rowCount,
        }
      },
    }),
  }

  try {
    await client.query('BEGIN')
    const result = await fn(tx)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function writeLog(userId, action, module, targetId, fieldName, oldValue, newValue, ip, targetName) {
  return prepare(
    'INSERT INTO pms_op_log (user_id, action, module, target_id, field_name, old_value, new_value, ip, target_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, action, module, targetId, fieldName, oldValue, newValue, ip, targetName || null)
}

module.exports = { prepare, exec, transaction, writeLog, pool }
