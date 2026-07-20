const { insertRows, quoteIdentifier } = require('./db')
const { transformLegacyDataset } = require('./dataset')
const {
  BUSINESS_ROLE_MENU_CODES,
  CONFIRMED_LEGACY_COUNTS,
  assertLegacySnapshot,
  parseMemberIds,
} = require('./transform')

const SOURCE_TABLES = Object.keys(CONFIRMED_LEGACY_COUNTS)

const TABLE_COLUMNS = Object.freeze({
  pms_user: ['id', 'employee_no', 'real_name', 'phone', 'password', 'status', 'first_login', 'creator_id', 'updater_id', 'is_deleted', 'created_at', 'updated_at'],
  pms_role: ['id', 'code', 'name', 'description', 'creator_id', 'updater_id', 'is_deleted', 'created_at', 'updated_at'],
  pms_user_role: ['id', 'user_id', 'role_id', 'created_at'],
  pms_product: ['id', 'name', 'description', 'owner_id', 'status', 'creator_id', 'updater_id', 'is_deleted', 'created_at', 'updated_at'],
  pms_project: ['id', 'name', 'description', 'product_id', 'owner_id', 'status', 'is_overdue', 'start_date', 'expected_end_date', 'actual_end_date', 'suspend_date', 'progress_text', 'risk_text', 'creator_id', 'updater_id', 'is_deleted', 'created_at', 'updated_at'],
  pms_project_member: ['project_id', 'user_id'],
  pms_requirement: ['id', 'title', 'description', 'requirement_type', 'product_id', 'project_id', 'owner_id', 'priority', 'status', 'is_overdue', 'submitter_name', 'submitter_dept', 'submit_date', 'start_date', 'expected_end_date', 'actual_end_date', 'pause_date', 'completion_status', 'creator_id', 'updater_id', 'is_deleted', 'created_at', 'updated_at'],
  pms_task: ['id', 'name', 'description', 'parent_task_id', 'source_type', 'project_id', 'requirement_id', 'owner_id', 'task_type', 'priority', 'status', 'is_overdue', 'start_date', 'expected_end_date', 'actual_end_date', 'suspend_date', 'creator_id', 'updater_id', 'is_deleted', 'created_at', 'updated_at'],
  pms_op_log: ['id', 'user_id', 'action', 'module', 'target_id', 'target_name', 'field_name', 'old_value', 'new_value', 'ip', 'created_at'],
})

async function mysqlRows(source, sql, params = []) {
  const [rows] = await source.query(sql, params)
  return rows
}

async function loadSourceCounts(source) {
  const counts = {}
  for (const table of SOURCE_TABLES) {
    const rows = await mysqlRows(source, `SELECT COUNT(*) AS count FROM \`${table}\``)
    counts[table] = Number(rows[0].count)
  }
  return counts
}

async function assertNoActiveDuplicates(source, table, column) {
  const rows = await mysqlRows(source, `
    SELECT \`${column}\` AS value, COUNT(*) AS count
    FROM \`${table}\`
    WHERE is_deleted = 0
    GROUP BY \`${column}\`
    HAVING COUNT(*) > 1
  `)
  if (rows.length) throw new Error(`${table}.${column} 存在未删除重复值，无法满足新库唯一约束`)
}

async function runSourcePrecheck(source) {
  const counts = await loadSourceCounts(source)
  assertLegacySnapshot(counts)
  for (const [table, column] of [
    ['pms_product', 'name'],
    ['pms_project', 'name'],
    ['pms_requirement', 'title'],
    ['pms_task', 'name'],
  ]) await assertNoActiveDuplicates(source, table, column)

  const gaps = await mysqlRows(source, `
    SELECT
      SUM(phone IS NULL OR TRIM(phone) = '') AS user_phone,
      (SELECT COUNT(*) FROM pms_project WHERE product_id IS NULL OR owner_id IS NULL OR expected_end_date IS NULL) AS project_required,
      (SELECT COUNT(*) FROM pms_requirement WHERE product_id IS NULL OR owner_id IS NULL OR submit_date IS NULL) AS requirement_required,
      (SELECT COUNT(*) FROM pms_task WHERE owner_id IS NULL OR NOT ((source_type=1 AND project_id IS NOT NULL AND requirement_id IS NULL) OR (source_type=2 AND requirement_id IS NOT NULL AND project_id IS NULL))) AS task_required
    FROM pms_user
  `)
  const invalid = Object.entries(gaps[0]).filter(([, value]) => Number(value) !== 0)
  if (invalid.length) throw new Error(`源库必填或关联检查失败：${invalid.map(([key, value]) => `${key}=${value}`).join(', ')}`)

  const userIds = new Set((await mysqlRows(source, 'SELECT id FROM pms_user')).map((row) => Number(row.id)))
  const projects = await mysqlRows(source, 'SELECT id, member_ids FROM pms_project ORDER BY id')
  for (const project of projects) {
    for (const memberId of parseMemberIds(project.member_ids)) {
      if (!userIds.has(memberId)) throw new Error(`项目 ${project.id} 引用了不存在的成员 ${memberId}`)
    }
  }
  return counts
}

async function loadLegacyDataset(source) {
  const [users, roles, userRoles, archiveTypes, archives, products, projects, requirements, tasks, operationLogs] = await Promise.all([
    mysqlRows(source, 'SELECT id,employee_no,real_name,phone,password,status,first_login,creator_id,updater_id,is_deleted,created_at,updated_at FROM pms_user ORDER BY id'),
    mysqlRows(source, 'SELECT id,code,name,description,creator_id,updater_id,is_deleted,created_at,updated_at FROM pms_role ORDER BY id'),
    mysqlRows(source, 'SELECT id,user_id,role_id,created_at FROM pms_user_role ORDER BY id'),
    mysqlRows(source, 'SELECT id,code,code_prefix,name,status,creator_id,updater_id,is_deleted,created_at,updated_at FROM pms_archive_type ORDER BY id'),
    mysqlRows(source, `SELECT a.id,a.code,a.name,a.sort_order,a.status,a.creator_id,a.updater_id,a.is_deleted,a.created_at,a.updated_at,t.code AS archive_type_code FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id ORDER BY a.id`),
    mysqlRows(source, 'SELECT id,name,description,owner_id,status,creator_id,updater_id,is_deleted,created_at,updated_at FROM pms_product ORDER BY id'),
    mysqlRows(source, 'SELECT id,name,description,product_id,owner_id,member_ids,status,is_overdue,start_date,expected_end_date,actual_end_date,suspend_date,progress_text,risk_text,creator_id,updater_id,is_deleted,created_at,updated_at FROM pms_project ORDER BY id'),
    mysqlRows(source, 'SELECT id,title,description,requirement_type,product_id,project_id,owner_id,priority,status,is_overdue,submitter_name,submitter_dept,submit_date,start_date,expected_end_date,actual_end_date,pause_date,completion_status,creator_id,updater_id,is_deleted,created_at,updated_at FROM pms_requirement ORDER BY id'),
    mysqlRows(source, 'SELECT id,name,description,source_type,project_id,requirement_id,owner_id,task_type,priority,status,is_overdue,start_date,expected_end_date,actual_end_date,suspend_date,creator_id,updater_id,is_deleted,created_at,updated_at FROM pms_task ORDER BY id'),
    mysqlRows(source, 'SELECT id,user_id,action,module,target_id,target_name,field_name,old_value,new_value,ip,created_at FROM pms_operation_log ORDER BY id'),
  ])
  return { users, roles, userRoles, archiveTypes, archives, products, projects, requirements, tasks, operationLogs }
}

async function assertTargetReady(target) {
  const result = await target.query(`
    SELECT
      to_regclass('public.pms_user') IS NOT NULL AS has_schema,
      (SELECT COUNT(*) FROM pms_product)
        + (SELECT COUNT(*) FROM pms_project)
        + (SELECT COUNT(*) FROM pms_requirement)
        + (SELECT COUNT(*) FROM pms_task)
        + (SELECT COUNT(*) FROM pms_bug)
        + (SELECT COUNT(*) FROM pms_work_order)
        + (SELECT COUNT(*) FROM pms_op_log)
        + (SELECT COUNT(*) FROM pms_access_log)
        + (SELECT COUNT(*) FROM pms_message)
        + (SELECT COUNT(*) FROM pms_user_preference) AS business_count,
      (SELECT COUNT(*) FROM pms_user) AS user_count,
      (SELECT COUNT(*) FROM pms_role) AS role_count,
      EXISTS (SELECT 1 FROM pms_migrations) AS has_baseline
  `)
  const state = result.rows[0]
  if (!state?.has_schema) throw new Error('目标库缺少 PMIS 初始化结构')
  if (Number(state.business_count) !== 0 || Number(state.user_count) !== 1 || Number(state.role_count) !== 1) {
    throw new Error('目标库不是全新初始化状态，拒绝导入')
  }
  if (!state.has_baseline) throw new Error('目标库尚未登记 migration 基线')
}

async function resetSequence(target, table) {
  const quoted = quoteIdentifier(table)
  await target.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE((SELECT MAX(id) FROM ${quoted}), 1), true)`)
}

async function rebuildRoleMenus(target) {
  await target.query('DELETE FROM pms_role_menu')
  await target.query(`
    INSERT INTO pms_role_menu (role_id, menu_id)
    SELECT r.id, m.id FROM pms_role r CROSS JOIN pms_menu m
    WHERE r.code = 'admin' AND r.is_deleted = 0 AND m.is_deleted = 0 AND m.status = 1
  `)
  await target.query(`
    INSERT INTO pms_role_menu (role_id, menu_id)
    SELECT r.id, m.id FROM pms_role r JOIN pms_menu m ON m.code = ANY($1::text[])
    WHERE r.code = 'JS_001' AND r.is_deleted = 0 AND m.is_deleted = 0 AND m.status = 1
  `, [BUSINESS_ROLE_MENU_CODES])
}

async function replaceTaskTypeArchives(target, legacyArchives) {
  const typeResult = await target.query("SELECT id FROM pms_archive_type WHERE code='task_type' AND is_deleted=0")
  const archiveTypeId = Number(typeResult.rows[0]?.id)
  if (!archiveTypeId) throw new Error('目标库缺少 task_type 档案类型')
  await target.query('DELETE FROM pms_archive WHERE archive_type_id = $1', [archiveTypeId])
  const rows = legacyArchives
    .filter((row) => row.archive_type_code === 'task_type')
    .map((row) => ({ ...row, archive_type_id: archiveTypeId }))
  await insertRows(target, 'pms_archive', ['code', 'name', 'archive_type_id', 'sort_order', 'status', 'creator_id', 'updater_id', 'is_deleted', 'created_at', 'updated_at'], rows)
  const result = await target.query('SELECT id,code FROM pms_archive WHERE archive_type_id=$1', [archiveTypeId])
  return new Map(result.rows.map((row) => [row.code, Number(row.id)]))
}

async function runImport({ source, target }) {
  const sourceCounts = await runSourcePrecheck(source)
  await assertTargetReady(target)
  const raw = await loadLegacyDataset(source)

  await target.query('BEGIN')
  try {
    const identityData = transformLegacyDataset({
      users: raw.users,
      roles: raw.roles,
      userRoles: raw.userRoles,
    }, new Map())
    await insertRows(target, 'pms_user', TABLE_COLUMNS.pms_user, identityData.users, {
      suffix: 'ON CONFLICT (id) DO UPDATE SET employee_no=EXCLUDED.employee_no,real_name=EXCLUDED.real_name,phone=EXCLUDED.phone,password=EXCLUDED.password,status=EXCLUDED.status,first_login=EXCLUDED.first_login,creator_id=EXCLUDED.creator_id,updater_id=EXCLUDED.updater_id,is_deleted=EXCLUDED.is_deleted,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at',
    })
    await insertRows(target, 'pms_role', TABLE_COLUMNS.pms_role, identityData.roles, {
      suffix: 'ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,description=EXCLUDED.description,creator_id=EXCLUDED.creator_id,updater_id=EXCLUDED.updater_id,is_deleted=EXCLUDED.is_deleted,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at',
    })
    await target.query('DELETE FROM pms_user_role')
    await insertRows(target, 'pms_user_role', TABLE_COLUMNS.pms_user_role, identityData.userRoles)
    await rebuildRoleMenus(target)

    const targetTaskTypeIdByCode = await replaceTaskTypeArchives(target, transformLegacyDataset({ archives: raw.archives }, new Map()).archives)
    const data = transformLegacyDataset(raw, targetTaskTypeIdByCode)

    await insertRows(target, 'pms_product', TABLE_COLUMNS.pms_product, data.products)
    await insertRows(target, 'pms_project', TABLE_COLUMNS.pms_project, data.projects)
    await insertRows(target, 'pms_project_member', TABLE_COLUMNS.pms_project_member, data.projectMembers)
    await insertRows(target, 'pms_requirement', TABLE_COLUMNS.pms_requirement, data.requirements)
    await insertRows(target, 'pms_task', TABLE_COLUMNS.pms_task, data.tasks.map((row) => ({ ...row, parent_task_id: null })))
    await insertRows(target, 'pms_op_log', TABLE_COLUMNS.pms_op_log, data.operationLogs)

    for (const table of ['pms_user', 'pms_role', 'pms_user_role', 'pms_product', 'pms_project', 'pms_project_member', 'pms_requirement', 'pms_task', 'pms_op_log', 'pms_role_menu', 'pms_archive']) {
      await resetSequence(target, table)
    }
    await target.query('COMMIT')

    return {
      source: sourceCounts,
      target: {
        pms_user: data.users.length,
        pms_role: data.roles.length,
        pms_user_role: data.userRoles.length,
        pms_archive: data.archives.filter((row) => row.archive_type_code === 'task_type').length,
        pms_product: data.products.length,
        pms_project: data.projects.length,
        pms_project_member: data.projectMembers.length,
        pms_requirement: data.requirements.length,
        pms_task: data.tasks.length,
        pms_op_log: data.operationLogs.length,
      },
      discarded: {
        pms_milestone: sourceCounts.pms_milestone,
        pms_mcp_audit_log: sourceCounts.pms_mcp_audit_log,
        milestone_operation_log: raw.operationLogs.length - data.operationLogs.length,
      },
    }
  } catch (error) {
    await target.query('ROLLBACK')
    throw error
  }
}

async function verifyImportedData({ source, target }) {
  const sourceCounts = await loadSourceCounts(source)
  assertLegacySnapshot(sourceCounts)
  const expected = {
    pms_user: sourceCounts.pms_user,
    pms_role: sourceCounts.pms_role,
    pms_user_role: sourceCounts.pms_user_role,
    pms_product: sourceCounts.pms_product,
    pms_project: sourceCounts.pms_project,
    pms_project_member: 18,
    pms_requirement: sourceCounts.pms_requirement,
    pms_task: sourceCounts.pms_task,
    pms_op_log: sourceCounts.pms_operation_log - 7,
  }
  const actual = {}
  for (const table of Object.keys(expected)) {
    const result = await target.query(`SELECT COUNT(*)::INTEGER AS count FROM ${quoteIdentifier(table)}`)
    actual[table] = Number(result.rows[0].count)
    if (actual[table] !== expected[table]) throw new Error(`迁移核验失败：${table}，预期 ${expected[table]}，实际 ${actual[table]}`)
  }
  const orphanResult = await target.query(`
    SELECT
      (SELECT COUNT(*) FROM pms_project_member pm LEFT JOIN pms_project p ON p.id=pm.project_id LEFT JOIN pms_user u ON u.id=pm.user_id WHERE p.id IS NULL OR u.id IS NULL)
      + (SELECT COUNT(*) FROM pms_task t LEFT JOIN pms_user u ON u.id=t.owner_id LEFT JOIN pms_archive a ON a.id=t.task_type WHERE u.id IS NULL OR a.id IS NULL) AS count
  `)
  if (Number(orphanResult.rows[0].count) !== 0) throw new Error('迁移核验失败：存在项目成员或任务孤儿关系')
  return { source: sourceCounts, target: actual }
}

module.exports = {
  assertTargetReady,
  loadLegacyDataset,
  loadSourceCounts,
  runImport,
  runSourcePrecheck,
  verifyImportedData,
}
