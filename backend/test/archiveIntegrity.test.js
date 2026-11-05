const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const enabled = process.env.RUN_DB_INTEGRATION === '1'

test('档案编号与类型生命周期的 PostgreSQL 回归', { skip: !enabled }, async (t) => {
  const schema = `archive_regression_${process.pid}_${Date.now()}`
  process.env.DB_OPTIONS = `-c search_path=${schema} -c application_name=${schema} -c statement_timeout=10000`
  const db = require('../src/db')
  const types = require('../src/controllers/archiveTypeController')
  const archives = require('../src/controllers/archiveController')
  const source = readFileSync(join(__dirname, '../db/init/001_schema.sql'), 'utf8')

  async function invoke(handler, body = {}, id) {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(value) { this.body = value; return this }
    }
    await handler({ body, params: { id }, user: { id: 1 }, ip: '127.0.0.1' }, res)
    return res
  }

  async function seedType(code = '001', prefix = 'TD', deleted = 0) {
    return db.prepare('INSERT INTO pms_archive_type (code, code_prefix, name, is_deleted) VALUES (?, ?, ?, ?)')
      .run(code, prefix, '回归类型', deleted)
  }

  async function waitUntil(predicate) {
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      if (await predicate()) return
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.fail('等待并发请求进入数据库锁阶段超时')
  }

  async function hasBlockedQuery(pattern) {
    const result = await db.pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock' AND query ILIKE $2",
      [schema, pattern]
    )
    return result.rowCount > 0
  }

  try {
    await db.pool.query(`CREATE SCHEMA ${schema}`)
    for (const table of ['pms_user', 'pms_archive_type', 'pms_archive', 'pms_op_log']) {
      const definition = source.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))
      assert.ok(definition, `缺少真实表结构 ${table}`)
      await db.pool.query(definition[0])
    }
    for (const statement of source.matchAll(/CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_archive_type[^;]+;/g)) {
      await db.pool.query(statement[0])
    }
    await db.pool.query("INSERT INTO pms_user (id, employee_no, real_name, phone, password) VALUES (1, 'test', '测试用户', 'test', 'unused')")
    t.beforeEach(async () => {
      await db.pool.query('TRUNCATE pms_archive, pms_archive_type, pms_op_log RESTART IDENTITY CASCADE')
    })

    await t.test('旧表名和现表名的全表唯一约束迁移后均允许复用已删除类型', async () => {
      const names = ['archive_type_code_key', 'archive_type_code_prefix_key', 'pms_archive_type_code_key', 'pms_archive_type_code_prefix_key']
      try {
        for (const name of names) {
          const column = name.includes('prefix') ? 'code_prefix' : 'code'
          await db.pool.query(`ALTER TABLE pms_archive_type ADD CONSTRAINT ${name} UNIQUE (${column})`)
        }
        await seedType('001', 'TD', 1)
        const migration = readFileSync(join(__dirname, '../db/migrations/20261105_01_archive_type_legacy_uniqueness.sql'), 'utf8')
        await db.transaction(async conn => { await conn.query(migration) })
        await db.transaction(async conn => { await conn.query(migration) })
        const created = await invoke(types.create, { code_prefix: 'TD', name: '复用前缀' })
        assert.equal(created.statusCode, 200)
        assert.equal(created.body.data.code, '001')
        const duplicate = await invoke(types.create, { code_prefix: 'TD', name: '活动类型重复' })
        assert.equal(duplicate.statusCode, 400)
        assert.ok(duplicate.body.fieldErrors.code_prefix)
      } finally {
        for (const name of names) await db.pool.query(`ALTER TABLE pms_archive_type DROP CONSTRAINT IF EXISTS ${name}`)
      }
    })

    await t.test('非数字类型编码不阻断新增，已删除数字编码仍可复用', async () => {
      await seedType('001', 'A')
      await seedType('TD', 'TD')
      await seedType('999', 'OLD', 1)
      const created = await invoke(types.create, { code_prefix: 'NEW', name: '新类型' })
      assert.equal(created.statusCode, 200)
      assert.equal(created.body.data.code, '002')
    })

    await t.test('复用已删除类型前缀时，档案编码接续历史序号', async () => {
      const oldType = await seedType()
      await db.prepare("INSERT INTO pms_archive (code, name, archive_type_id, is_deleted) VALUES ('TD001', '历史档案', ?, 1)")
        .run(oldType.lastInsertRowid)
      assert.equal((await invoke(types.remove, {}, oldType.lastInsertRowid)).statusCode, 200)
      const newType = await invoke(types.create, { code_prefix: 'TD', name: '新类型' })
      assert.equal(newType.statusCode, 200)
      const created = await invoke(archives.create, { archive_type_id: Number(newType.body.data.id), name: '新档案' })
      assert.equal(created.statusCode, 200)
      assert.equal(created.body.data.code, 'TD002')
    })

    await t.test('不存在或已删除类型拒绝新增档案', async () => {
      const deleted = await seedType('TD', 'TD', 1)
      for (const id of [Number(deleted.lastInsertRowid), 999999]) {
        const created = await invoke(archives.create, { archive_type_id: id, name: '无效档案' })
        assert.equal(created.statusCode, 400)
      }
      assert.equal((await db.prepare('SELECT COUNT(*)::integer AS count FROM pms_archive').get()).count, 0)
      assert.equal((await db.prepare('SELECT COUNT(*)::integer AS count FROM pms_op_log').get()).count, 0)
    })

    await t.test('并发新增类型分配不同编号，重复前缀返回字段错误', async () => {
      const results = await Promise.all(Array.from({ length: 6 }, (_, index) =>
        invoke(types.create, { code_prefix: `T${index}`, name: '并发类型' })
      ))
      assert.deepEqual(results.map((result) => result.statusCode), [200, 200, 200, 200, 200, 200])
      assert.equal(new Set(results.map((result) => result.body.data.code)).size, 6)
      const duplicate = await invoke(types.create, { code_prefix: 'T0', name: '重复类型' })
      assert.equal(duplicate.statusCode, 400)
      assert.ok(duplicate.body.fieldErrors.code_prefix)
    })

    await t.test('并发新增档案保持编码唯一且排序连续', async () => {
      const type = await seedType()
      const results = await Promise.all(Array.from({ length: 8 }, () =>
        invoke(archives.create, { archive_type_id: Number(type.lastInsertRowid), name: '并发档案' })
      ))
      assert.ok(results.every((result) => result.statusCode === 200))
      assert.deepEqual(results.map((result) => result.body.data.code).sort(),
        ['TD001', 'TD002', 'TD003', 'TD004', 'TD005', 'TD006', 'TD007', 'TD008'])
      const rows = await db.prepare('SELECT sort_order FROM pms_archive ORDER BY sort_order').all()
      assert.deepEqual(rows.map((row) => row.sort_order), [1, 2, 3, 4, 5, 6, 7, 8])
    })

    await t.test('前缀按字面匹配，忽略非数字后缀并避免重叠前缀冲突', async () => {
      const literal = await seedType('001', 'A_%')
      const overlap = await seedType('002', 'A')
      await db.prepare('INSERT INTO pms_archive (code, name, archive_type_id) VALUES (?, ?, ?)')
        .run('A_%bad', '非标准历史编码', literal.lastInsertRowid)
      await db.prepare('INSERT INTO pms_archive (code, name, archive_type_id) VALUES (?, ?, ?)')
        .run('Axx999', '其他前缀', overlap.lastInsertRowid)
      const created = await invoke(archives.create, { archive_type_id: Number(literal.lastInsertRowid), name: '字面前缀' })
      assert.equal(created.statusCode, 200)
      assert.equal(created.body.data.code, 'A_%001')
      const nested = await seedType('003', 'A1')
      await db.prepare('INSERT INTO pms_archive (code, name, archive_type_id) VALUES (?, ?, ?)')
        .run('A1001', '共享编码空间', overlap.lastInsertRowid)
      const next = await invoke(archives.create, { archive_type_id: Number(nested.lastInsertRowid), name: '重叠前缀' })
      assert.equal(next.statusCode, 200)
      assert.equal(next.body.data.code, 'A1002')
    })

    await t.test('非 BMP 字符前缀和超过整数上限的历史序号仍能接续', async () => {
      const type = await seedType('2147483648', '档📁')
      const nextType = await invoke(types.create, { code_prefix: 'NEXT', name: '大序号类型' })
      assert.equal(nextType.statusCode, 200)
      assert.equal(nextType.body.data.code, '2147483649')
      await db.prepare('INSERT INTO pms_archive (code, name, archive_type_id) VALUES (?, ?, ?)')
        .run('档📁2147483648', '历史大序号', type.lastInsertRowid)
      const created = await invoke(archives.create, { archive_type_id: Number(type.lastInsertRowid), name: '新档案' })
      assert.equal(created.statusCode, 200)
      assert.equal(created.body.data.code, '档📁2147483649')
    })

    await t.test('日志写入失败时新增和删除整体回滚', async (subtest) => {
      subtest.mock.method(console, 'error', () => {})
      const type = await seedType()
      await db.pool.query(`
        CREATE FUNCTION reject_archive_log() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION '模拟日志写入失败'; END $$;
        CREATE TRIGGER reject_log BEFORE INSERT ON pms_op_log
        FOR EACH ROW EXECUTE FUNCTION reject_archive_log();
      `)
      try {
        assert.equal((await invoke(types.create, { code_prefix: 'NEW', name: '新类型' })).statusCode, 500)
        assert.equal((await invoke(archives.create, { archive_type_id: Number(type.lastInsertRowid), name: '新档案' })).statusCode, 500)
        assert.equal((await invoke(types.remove, {}, type.lastInsertRowid)).statusCode, 500)
        assert.equal((await db.prepare('SELECT COUNT(*)::integer AS count FROM pms_archive_type').get()).count, 1)
        assert.equal((await db.prepare('SELECT is_deleted FROM pms_archive_type WHERE id = ?').get(type.lastInsertRowid)).is_deleted, 0)
        assert.equal((await db.prepare('SELECT COUNT(*)::integer AS count FROM pms_archive').get()).count, 0)
      } finally {
        await db.pool.query('DROP TRIGGER reject_log ON pms_op_log; DROP FUNCTION reject_archive_log()')
      }
    })

    for (const first of ['create', 'delete']) {
      await t.test(`并发${first === 'create' ? '先新增再删除' : '先删除再新增'}不留下活动档案引用已删除类型`, async () => {
        const type = await seedType()
        const id = Number(type.lastInsertRowid)
        const blocker = await db.pool.connect()
        const table = first === 'create' ? 'pms_archive' : 'pms_archive_type'
        const event = first === 'create' ? 'INSERT' : 'UPDATE'
        await db.pool.query(`
          CREATE FUNCTION pause_archive_write() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN PERFORM pg_advisory_xact_lock(hashtext('${schema}'), 1); RETURN NEW; END $$;
          CREATE TRIGGER pause_write BEFORE ${event} ON ${table}
          FOR EACH ROW EXECUTE FUNCTION pause_archive_write();
        `)
        let firstRequest
        let secondRequest
        try {
          await blocker.query('SELECT pg_advisory_lock(hashtext($1), 1)', [schema])
          const create = () => invoke(archives.create, { archive_type_id: id, name: '并发新增' })
          const remove = () => invoke(types.remove, {}, id)
          firstRequest = first === 'create' ? create() : remove()
          await waitUntil(() => hasBlockedQuery(first === 'create' ? 'INSERT INTO pms_archive %' : 'UPDATE pms_archive_type %'))
          let secondFinished = false
          secondRequest = (first === 'create' ? remove() : create()).then((result) => {
            secondFinished = true
            return result
          })
          await waitUntil(async () => secondFinished
            || await hasBlockedQuery('SELECT pg_advisory_xact_lock%')
            || (first === 'delete' && await hasBlockedQuery('INSERT INTO pms_archive %')))
        } finally {
          await blocker.query('SELECT pg_advisory_unlock(hashtext($1), 1)', [schema])
          blocker.release()
          await Promise.allSettled([firstRequest, secondRequest].filter(Boolean))
          await db.pool.query(`DROP TRIGGER pause_write ON ${table}; DROP FUNCTION pause_archive_write()`)
        }
        assert.equal((await firstRequest).statusCode, 200)
        assert.equal((await secondRequest).statusCode, 400)
        const orphan = await db.prepare(`SELECT COUNT(*)::integer AS count FROM pms_archive a
          JOIN pms_archive_type t ON t.id = a.archive_type_id WHERE a.is_deleted = 0 AND t.is_deleted = 1`).get()
        assert.equal(orphan.count, 0)
      })
    }
  } finally {
    await db.pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await db.pool.end()
  }
})
