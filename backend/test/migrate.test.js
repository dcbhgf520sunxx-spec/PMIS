const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { applyMigrations, baselineMigrations, getPendingMigrations, listMigrationFiles, resolveMigrationMode, runMigrationCommand } = require('../scripts/migrate')

test('defaults the migration command to check-only mode', () => {
  assert.equal(resolveMigrationMode([]), 'check')
})

test('rejects apply mode without an explicit user approval flag', () => {
  assert.throws(
    () => resolveMigrationMode(['--apply']),
    /缺少 --user-approved/
  )
})

test('allows apply mode only with an explicit user approval flag', () => {
  assert.equal(resolveMigrationMode(['--apply', '--user-approved']), 'apply')
})

test('rejects conflicting migration modes before connecting to the database', async () => {
  assert.throws(
    () => resolveMigrationMode(['--baseline', '--apply', '--user-approved']),
    /不能同时使用 --baseline 和 --apply/
  )
})

test('runs the migration command in check-only mode when no arguments are provided', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, '20260716_01_pending.sql'), 'SELECT 42;')
  const queries = []
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes("to_regclass('public.pms_migrations')")) return { rows: [{ name: 'pms_migrations' }] }
      return sql.includes('SELECT 1 FROM pms_migrations') ? { rows: [] } : { rows: [] }
    },
    release() {}
  }
  const connectionPool = {
    async connect() { return client },
    async end() {}
  }

  await runMigrationCommand({ args: [], directory, connectionPool, log() {} })

  assert.ok(queries.some((sql) => sql.includes('SELECT 1 FROM pms_migrations')))
  assert.ok(!queries.includes('SELECT 42;'))
  assert.ok(!queries.some((sql) => sql.includes('CREATE TABLE')))
})

test('reports every migration without querying records when the migration table is missing', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, '20260716_01_pending.sql'), 'SELECT 42;')
  const queries = []
  const messages = []
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes("to_regclass('public.pms_migrations')")) return { rows: [{ name: null }] }
      return { rows: [] }
    },
    release() {}
  }
  const connectionPool = {
    async connect() { return client },
    async end() {}
  }

  await runMigrationCommand({ args: [], directory, connectionPool, log: (message) => messages.push(message) })

  assert.deepEqual(messages, ['待执行迁移：20260716_01_pending.sql'])
  assert.ok(!queries.some((sql) => sql.includes('SELECT 1 FROM pms_migrations')))
})

test('lists SQL migration files in lexical order', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, '20260705_second.sql'), 'SELECT 2;')
  fs.writeFileSync(path.join(directory, '20260704_first.sql'), 'SELECT 1;')
  fs.writeFileSync(path.join(directory, 'notes.txt'), 'ignore')

  assert.deepEqual(listMigrationFiles(directory), [
    '20260704_first.sql',
    '20260705_second.sql'
  ])
})

test('rejects migration files without the required date prefix', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, 'bad-name.sql'), 'SELECT 1;')
  assert.throws(() => listMigrationFiles(directory), /YYYYMMDD_name\.sql/)
})

test('requires an explicit sequence for new same-day migrations', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, '20260716_without_sequence.sql'), 'SELECT 1;')
  assert.throws(() => listMigrationFiles(directory), /YYYYMMDD_01_name\.sql/)

  fs.rmSync(directory, { recursive: true })
  const orderedDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(orderedDirectory, '20260716_02_second.sql'), 'SELECT 2;')
  fs.writeFileSync(path.join(orderedDirectory, '20260716_01_first.sql'), 'SELECT 1;')
  assert.deepEqual(listMigrationFiles(orderedDirectory), [
    '20260716_01_first.sql',
    '20260716_02_second.sql'
  ])
})

test('applies only migrations that are not recorded', async () => {
  const queries = []
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params })
      if (sql.includes('SELECT 1 FROM pms_migrations')) {
        return { rows: params[0] === '20260704_done.sql' ? [{ exists: 1 }] : [] }
      }
      return { rows: [] }
    }
  }

  const applied = await applyMigrations({
    client,
    files: ['20260704_done.sql', '20260705_new.sql'],
    readFile: (file) => file === '20260705_new.sql' ? 'CREATE TABLE example (id INT);' : 'SELECT 1;'
  })

  assert.deepEqual(applied, ['20260705_new.sql'])
  assert.ok(queries.some(({ sql }) => sql === 'CREATE TABLE example (id INT);'))
  assert.ok(!queries.some(({ sql }) => sql === 'SELECT 1;'))
  assert.ok(queries.some(({ sql, params }) => sql.includes('INSERT INTO pms_migrations') && params[0] === '20260705_new.sql'))
})

test('lists migrations that still need execution', async () => {
  const client = {
    async query(sql, params = []) {
      if (sql.includes('SELECT 1 FROM pms_migrations')) {
        return { rows: params[0] === '20260704_done.sql' ? [{ exists: 1 }] : [] }
      }
      return { rows: [] }
    }
  }

  assert.deepEqual(
    await getPendingMigrations(client, ['20260704_done.sql', '20260705_new.sql']),
    ['20260705_new.sql']
  )
})

test('baselines a freshly initialized database without replaying historical SQL', async () => {
  const queries = []
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params })
      return { rows: [] }
    }
  }

  const recorded = await baselineMigrations(client, [
    '20260704_first.sql',
    '20260705_second.sql'
  ])

  assert.deepEqual(recorded, ['20260704_first.sql', '20260705_second.sql'])
  assert.equal(queries.filter(({ sql }) => sql.includes('INSERT INTO pms_migrations')).length, 2)
  assert.ok(!queries.some(({ sql }) => sql.includes('CREATE TABLE example')))
})

test('baselines all migration records in one transaction', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, '20260716_01_pending.sql'), 'SELECT 42;')
  const queries = []
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params })
      if (sql.includes('to_regclass') && sql.includes('has_user')) {
        return { rows: [{
          has_user: true,
          has_work_order: true,
          has_role_index: true,
          has_work_order_fk: true,
          has_business_data: false
        }] }
      }
      return { rows: [], rowCount: sql.includes('INSERT INTO pms_migrations') ? 1 : 0 }
    },
    release() {}
  }
  const connectionPool = {
    async connect() { return client },
    async end() {}
  }

  await runMigrationCommand({ args: ['--baseline'], directory, connectionPool, log() {} })

  assert.equal(queries[0].sql, 'BEGIN')
  assert.equal(queries.at(-1).sql, 'COMMIT')
})

test('rolls back the complete baseline when recording any migration fails', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, '20260716_01_pending.sql'), 'SELECT 42;')
  const queries = []
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes('to_regclass') && sql.includes('has_user')) {
        return { rows: [{
          has_user: true,
          has_work_order: true,
          has_role_index: true,
          has_work_order_fk: true,
          has_business_data: false
        }] }
      }
      if (sql.includes('INSERT INTO pms_migrations')) throw new Error('insert failed')
      return { rows: [], rowCount: 0 }
    },
    release() {}
  }
  const connectionPool = {
    async connect() { return client },
    async end() {}
  }

  await assert.rejects(
    runMigrationCommand({ args: ['--baseline'], directory, connectionPool, log() {} }),
    /insert failed/
  )

  assert.equal(queries[0], 'BEGIN')
  assert.equal(queries.at(-1), 'ROLLBACK')
})

test('rejects baseline mode when the database already contains business data', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  fs.writeFileSync(path.join(directory, '20260716_01_pending.sql'), 'SELECT 42;')
  const queries = []
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes('to_regclass') && sql.includes('has_user')) {
        return { rows: [{
          has_user: true,
          has_work_order: true,
          has_role_index: true,
          has_work_order_fk: true,
          has_business_data: true
        }] }
      }
      return { rows: [], rowCount: 0 }
    },
    release() {}
  }
  const connectionPool = {
    async connect() { return client },
    async end() {}
  }

  await assert.rejects(
    runMigrationCommand({ args: ['--baseline'], directory, connectionPool, log() {} }),
    /已包含业务数据/
  )

  assert.ok(!queries.some((sql) => sql.includes('INSERT INTO pms_migrations')))
  assert.equal(queries.at(-1), 'ROLLBACK')
})
