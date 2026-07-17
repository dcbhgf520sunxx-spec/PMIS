const fs = require('node:fs')
const path = require('node:path')
const { pool } = require('../src/db')

function resolveMigrationMode(args = []) {
  const baseline = args.includes('--baseline')
  const apply = args.includes('--apply')
  if (baseline && apply) {
    throw new Error('数据库迁移不能同时使用 --baseline 和 --apply')
  }
  if (baseline) return 'baseline'
  if (apply) {
    if (!args.includes('--user-approved')) {
      throw new Error('执行数据库迁移缺少 --user-approved，请先取得用户明确确认')
    }
    return 'apply'
  }
  return 'check'
}

function listMigrationFiles(directory) {
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.sql'))
  const invalid = files.filter((file) => !/^\d{8}_[a-z0-9_]+\.sql$/.test(file))
  if (invalid.length) throw new Error(`迁移文件名不符合 YYYYMMDD_name.sql：${invalid.join(', ')}`)
  const missingSequence = files.filter((file) => file.slice(0, 8) >= '20260716' && !/^\d{8}_\d{2}_[a-z0-9_]+\.sql$/.test(file))
  if (missingSequence.length) throw new Error(`新迁移文件名不符合 YYYYMMDD_01_name.sql：${missingSequence.join(', ')}`)
  return files.sort()
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pms_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function migrationsTableExists(client) {
  const result = await client.query("SELECT to_regclass('public.pms_migrations') AS name")
  return Boolean(result.rows[0]?.name)
}

async function getPendingMigrations(client, files) {
  const pending = []
  for (const file of files) {
    const existing = await client.query(
      'SELECT 1 FROM pms_migrations WHERE name = $1',
      [file]
    )
    if (!existing.rows.length) pending.push(file)
  }
  return pending
}

async function baselineMigrations(client, files) {
  await ensureMigrationsTable(client)
  const recorded = []
  for (const file of files) {
    const result = await client.query(
      'INSERT INTO pms_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [file]
    )
    if (result.rowCount !== 0) recorded.push(file)
  }
  return recorded
}

async function assertBaselineReady(client) {
  const result = await client.query(`
    SELECT
      to_regclass('public.pms_user') IS NOT NULL AS has_user,
      to_regclass('public.pms_work_order') IS NOT NULL AS has_work_order,
      to_regclass('public.ux_pms_role_code_active') IS NOT NULL AS has_role_index,
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_pms_work_order_product'
          AND conrelid = 'pms_work_order'::regclass
      ) AS has_work_order_fk,
      EXISTS (SELECT 1 FROM pms_product)
        OR EXISTS (SELECT 1 FROM pms_project)
        OR EXISTS (SELECT 1 FROM pms_requirement)
        OR EXISTS (SELECT 1 FROM pms_task)
        OR EXISTS (SELECT 1 FROM pms_bug)
        OR EXISTS (SELECT 1 FROM pms_work_order)
        OR EXISTS (SELECT 1 FROM pms_access_log)
        OR EXISTS (SELECT 1 FROM pms_op_log)
        OR EXISTS (SELECT 1 FROM pms_message)
        OR EXISTS (SELECT 1 FROM pms_user_preference)
        OR EXISTS (SELECT 1 FROM pms_user WHERE id <> 1 OR employee_no <> 'admin')
        OR EXISTS (SELECT 1 FROM pms_role WHERE id <> 1 OR code <> 'admin')
        OR (SELECT COUNT(*) FROM pms_user_role) <> 1
        OR (SELECT COUNT(*) FROM pms_menu) <> 22
        OR (SELECT COUNT(*) FROM pms_role_menu) <> 22
        OR (SELECT COUNT(*) FROM pms_archive_type) <> 5
        OR (SELECT COUNT(*) FROM pms_archive) <> 26
        AS has_business_data
  `)
  const state = result.rows[0]
  if (!state?.has_user || !state?.has_work_order || !state?.has_role_index || !state?.has_work_order_fk) {
    throw new Error('当前数据库不是由最新版初始化 SQL 创建，禁止建立 migration 基线')
  }
  if (state.has_business_data) {
    throw new Error('当前数据库已包含业务数据，禁止建立 migration 基线')
  }
}

async function applyMigrations({ client, files, readFile }) {
  await ensureMigrationsTable(client)

  const applied = []
  for (const file of files) {
    const pending = await getPendingMigrations(client, [file])
    if (!pending.length) continue

    await client.query('BEGIN')
    try {
      await client.query(readFile(file))
      await client.query('INSERT INTO pms_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      applied.push(file)
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`迁移失败：${file}，${error.message}`)
    }
  }

  return applied
}

async function runMigrationCommand({
  args = process.argv.slice(2),
  directory = path.join(__dirname, '../db/migrations'),
  connectionPool = pool,
  log = console.log
} = {}) {
  const mode = resolveMigrationMode(args)
  const client = await connectionPool.connect()
  try {
    const files = listMigrationFiles(directory)
    if (mode === 'baseline') {
      await client.query('BEGIN')
      try {
        await assertBaselineReady(client)
        const recorded = await baselineMigrations(client, files)
        log(recorded.length ? `已建立迁移基线：${recorded.join(', ')}` : '迁移基线已存在')
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
      return
    }
    if (mode === 'check') {
      const pending = await migrationsTableExists(client)
        ? await getPendingMigrations(client, files)
        : files
      log(pending.length ? `待执行迁移：${pending.join(', ')}` : '没有待执行迁移')
      return
    }
    const applied = await applyMigrations({
      client,
      files,
      readFile: (file) => fs.readFileSync(path.join(directory, file), 'utf8')
    })
    log(applied.length ? `已执行迁移：${applied.join(', ')}` : '没有待执行迁移')
  } finally {
    client.release()
    await connectionPool.end()
  }
}

if (require.main === module) {
  runMigrationCommand().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = {
  applyMigrations,
  baselineMigrations,
  getPendingMigrations,
  listMigrationFiles,
  resolveMigrationMode,
  runMigrationCommand
}
