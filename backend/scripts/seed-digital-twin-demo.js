// Only populates an explicitly named local demonstration product. Never a migration.
const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const assert = require('node:assert/strict')
const M = require('../src/services/digitalTwinModel')
const { calculateRequirementOverdue, validateRequirementStatusChange } = require('../src/services/requirementRules')
const { calculateTaskOverdue, validateTaskStatusChange } = require('../src/services/taskRules')
const { validateBugStatusChange } = require('../src/services/bugRules')
const { validatePlanItemStatusChange } = require('../src/services/projectStagePlanRules')
const { validateContractDates } = require('../src/services/productMaintenanceContractRules')
const { calculateOverdue } = require('../src/services/overdueRules')
const { getShanghaiDateText } = require('../src/utils/date')
const files = require('../src/services/projectContractAttachmentService')
const FIXTURE = path.join(__dirname, 'fixtures/digital-twin-demo.json')
const PRODUCT_NAME = '标讯通（数字孪生演示）'
const MARKER = '[SIDM-LOCAL-TWIN-DEMO-20261009]'
const tables = {
  products: 'pms_product', requirements: 'pms_requirement', projects: 'pms_project', tasks: 'pms_task',
  bugs: 'pms_bug', planStages: 'pms_project_plan_stage', planItems: 'pms_project_plan_item',
  contracts: 'pms_project_contract', paymentStages: 'pms_project_payment_stage', payments: 'pms_project_payment_record',
  maintenance: 'pms_product_maintenance_contract', orders: 'pms_work_order', followups: 'pms_follow_up_record'
}
function assertLocal(env) {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST || 'localhost'), '演示数据仅允许写入本机数据库')
  assert.notEqual(env.NODE_ENV, 'production', '禁止在生产环境导入演示数据')
}
function validateFixture(d) {
  assert.equal(d.meta.simulation, true)
  assert.equal(d.products.length, 1)
  const all = new Map(Object.keys(tables).flatMap(k => d[k].map(r => [r.id, { kind: k, row: r }])))
  const refKinds = { product_id: 'products', project_id: 'projects', requirement_id: 'requirements', parent_task_id: 'tasks', stage_id: null, contract_id: 'contracts', previous_contract_id: 'maintenance', task_id: 'tasks' }
  for (const [kind, table] of Object.entries(tables)) {
    assert.equal(new Set(d[kind].map(r => r.id)).size, d[kind].length, `${table} ID重复`)
    for (const r of d[kind]) {
      for (const [field, targetKind] of Object.entries(refKinds)) if (r[field]) {
        const target = all.get(r[field])
        assert.ok(target && (!targetKind || target.kind === targetKind), `${r.id} ${field}关联不存在`)
      }
      if (M.kinds[kind]) assert.equal(M.chain(d, kind, r.id)[0]?.id, d.products[0].id, `${r.id}未归属演示产品`)
      if (['tasks', 'bugs'].includes(kind)) assert.ok(r.source_type === 1 ? r.project_id && !r.requirement_id : r.source_type === 2 && r.requirement_id && !r.project_id)
      if (r.parent_task_id) {
        const p = all.get(r.parent_task_id).row
        assert.ok(!p.parent_task_id && p.source_type === r.source_type && p.project_id === r.project_id && p.requirement_id === r.requirement_id)
        if (p.status === 2) assert.equal(r.status, 2, '已完成主任务存在未完成子任务')
      }
    }
  }
  for (const r of d.requirements) {
    assert.equal(validateRequirementStatusChange(r.status, r, d.meta.as_of), null)
    const linked = d.projects.filter(p => p.requirement_id === r.id)
    assert.ok(linked.length <= 1)
    assert.equal(r.status === 36, linked.length === 1)
  }
  for (const r of d.tasks) assert.equal(validateTaskStatusChange(r.status, { ...r, suspend_date: r.status === 3 ? '2026-10-07' : null, suspend_reason: r.pause_reason }, d.meta.as_of), null)
  for (const r of d.bugs) assert.equal(validateBugStatusChange(r.status, { ...r, resolution_id: 1 }, d.meta.as_of), null)
  for (const r of d.planItems) assert.equal(validatePlanItemStatusChange(r.status, r, r.requires_delivery_file, d.evidence.filter(e => e.kind === 'planItems' && e.target_id === r.id).length, d.meta.as_of), null)
  for (const r of d.maintenance) assert.equal(validateContractDates({ serviceStartDate: r.service_start_date, serviceEndDate: r.service_end_date, previousServiceEndDate: all.get(r.previous_contract_id)?.row.service_end_date }), null)
  for (const c of d.contracts) {
    assert.equal(d.contracts.filter(r => r.project_id === c.project_id).length, 1)
    const stages = d.paymentStages.filter(s => s.contract_id === c.id)
    assert.equal(M.sum(stages, 'planned_amount'), c.contract_amount)
    for (const s of stages) assert.ok(M.sum(d.payments.filter(p => p.stage_id === s.id), 'payment_amount') <= s.planned_amount, '付款超过阶段金额')
  }
  for (const e of d.evidence) assert.ok(all.get(e.target_id)?.kind === e.kind)
  for (const e of d.events) assert.ok(all.get(e.target_id)?.kind === e.kind)
  return M.summary(d, d.meta.as_of)
}
async function seed(d, apply) {
  const db = require('../src/db')
  assertLocal(process.env)
  validateFixture(d)
  const hash = createHash('sha256').update(JSON.stringify(d)).digest('hex')
  const marker = `${MARKER} sha256:${hash}`
  const savedFiles = []
  try {
    return await db.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(20261009, 3118)')
      const existing = await tx.prepare('SELECT id,description FROM pms_product WHERE name=? AND is_deleted=0').get(PRODUCT_NAME)
      if (existing) {
        assert.ok(existing.description.includes(marker), '同名产品不是此样本，拒绝覆盖')
        return { alreadyExists: true, productId: String(existing.id), hash }
      }
      const users = await tx.prepare('SELECT id,real_name FROM pms_user WHERE is_deleted=0 AND status=1 ORDER BY id LIMIT 8').all()
      assert.equal(users.length, 8, '本地至少需要8个已有有效账号用于负责人映射')
      const archives = await tx.prepare(`SELECT a.id,a.code FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE a.is_deleted=0 AND a.status=1 AND t.is_deleted=0 AND t.status=1`).all()
      const archiveId = code => { const a = archives.find(r => r.code === code); assert.ok(a, `缺少基础档案 ${code}`); return a.id }
      const supplierType = await tx.prepare("SELECT id FROM pms_archive_type WHERE code='supplier' AND status=1 AND is_deleted=0").get()
      assert.ok(supplierType, '缺少供应商档案类型')
      if (!apply) return { preview: true, productName: PRODUCT_NAME, summary: M.summary(d, d.meta.as_of), evidenceFiles: d.evidence.filter(e => ['contracts','maintenance','planItems'].includes(e.kind)).length }
      const ids = new Map(), people = new Map(d.people.map((p, i) => [p.id, users[i].id]))
      const id = value => value ? ids.get(value) : null
      const owner = value => { assert.ok(people.has(value)); return people.get(value) }
      const today = getShanghaiDateText()
      const rowById = new Map(Object.keys(tables).flatMap(k => d[k].map(r => [r.id, r])))
      const timestamp = r => d.events.filter(e => e.target_id === r.id).reduce((date, e) => e.at > date ? e.at : date, r.created_at)
      const proofText = r => d.evidence.filter(e => e.target_id === r.id && ['requirements','projects'].includes(e.kind)).map(e => `\n\n${e.content}`).join('')
      const description = r => `<p>【本地虚构演示】${r.description || ''}</p>${proofText(r) ? `<pre>${proofText(r)}</pre>` : ''}`
      async function insert(table, values) {
        const keys = Object.keys(values)
        const result = await tx.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => values[k] ?? null))
        return String(result.lastInsertRowid)
      }
      async function business(kind, r, values) {
        const newId = await insert(tables[kind], { ...values, creator_id: users[0].id, updater_id: users[0].id, created_at: r.created_at, updated_at: timestamp(r) })
        ids.set(r.id, newId)
        return newId
      }
      for (const s of d.suppliers) {
        const code = `TWIN-DEMO-${s.id}`
        const prior = await tx.prepare('SELECT id,name,archive_type_id,is_deleted FROM pms_archive WHERE code=?').get(code)
        if (prior) { assert.ok(prior.name === s.name && String(prior.archive_type_id) === String(supplierType.id) && prior.is_deleted === 0); ids.set(s.id, String(prior.id)) }
        else ids.set(s.id, await insert('pms_archive', { code, name: s.name, archive_type_id: supplierType.id, creator_id: users[0].id, updater_id: users[0].id }))
      }
      for (const r of d.products) await business('products', r, { name: PRODUCT_NAME, description: `${marker}\n全部对象、状态、金额、时间和证据为虚构演示。人员借用已有本地账号，不表示真实责任或经营结果。\n${r.description}`, owner_id: owner(r.owner_id), status: 1 })
      for (const r of d.requirements) await business('requirements', r, { title: r.title, description: description(r), requirement_type: r.requirement_type, product_id: id(r.product_id), owner_id: owner(r.owner_id), priority: r.priority, status: r.status, is_overdue: calculateRequirementOverdue(r.expected_end_date, r.status, today), submitter_name: r.submitter_name, submitter_dept: r.submitter_dept, submit_date: r.submit_date, start_date: r.submit_date, expected_end_date: r.expected_end_date, actual_end_date: r.actual_end_date, pause_date: r.pause_date, pause_reason: r.pause_reason || null, completion_status: r.completion_status || null })
      for (const r of d.projects) {
        await business('projects', r, { name: r.name, description: description(r), product_id: id(r.product_id), requirement_id: id(r.requirement_id), owner_id: owner(r.owner_id), priority: 2, status: r.status, is_overdue: calculateOverdue('project', { date: r.expected_end_date, status: r.status }, today).isOverdue, start_date: r.start_date, expected_end_date: r.expected_end_date, actual_end_date: r.actual_end_date, suspend_date: r.suspend_date, suspend_reason: r.suspend_reason || null, progress_text: r.progress_text, risk_text: r.risk_text || null })
        for (const user of r.member_ids) await insert('pms_project_member', { project_id: id(r.id), user_id: owner(user) })
      }
      for (const r of d.planStages) await business('planStages', r, { project_id: id(r.project_id), name: r.name, sort_order: r.sort_order })
      for (const r of d.planItems) {
        await business('planItems', r, { stage_id: id(r.stage_id), name: r.name, owner_id: owner(r.owner_id), status: r.status, previous_status: r.status === 3 ? 0 : null, original_due_date: r.original_due_date, current_due_date: r.current_due_date, actual_end_date: r.actual_end_date, pause_reason: r.pause_reason || null, requires_delivery_file: Number(r.requires_delivery_file), delivery_requirement: r.delivery_requirement, remark: '本地虚构交付样本', sort_order: Number(r.id.split('-').at(-1)) })
        for (const [i, user] of r.collaborator_ids.entries()) await tx.prepare('INSERT INTO pms_project_plan_item_collaborator(plan_item_id,user_id,sort_order) VALUES(?,?,?) RETURNING plan_item_id AS id').run(id(r.id), owner(user), i)
        if (r.original_due_date !== r.current_due_date) await insert('pms_project_plan_adjustment', { plan_item_id: id(r.id), old_due_date: r.original_due_date, new_due_date: r.current_due_date, reason: '模拟：集成联调依赖变化，计划后移2天', operator_id: users[0].id, created_at: timestamp(r) })
      }
      // Parents first, then children; every child keeps its parent's business source.
      for (const r of [...d.tasks.filter(r => !r.parent_task_id), ...d.tasks.filter(r => r.parent_task_id)]) {
        await business('tasks', r, { name: `【孪生演示】${M.name(rowById.get(r.project_id || r.requirement_id))} · ${r.name}`, description: description(r), source_type: r.source_type, project_id: id(r.project_id), requirement_id: id(r.requirement_id), parent_task_id: id(r.parent_task_id), task_type: archiveId(r.parent_task_id ? 'TT003' : r.source_type === 2 ? 'TT001' : 'TT004'), priority: 1, status: r.status, is_overdue: calculateTaskOverdue(r.expected_end_date, r.status, today), start_date: r.created_at.slice(0,10), expected_end_date: r.expected_end_date, actual_end_date: r.actual_end_date, suspend_date: r.status === 3 ? '2026-10-07' : null, suspend_reason: r.status === 3 ? r.pause_reason : null })
        for (const [i, user] of r.owner_ids.entries()) await tx.prepare('INSERT INTO pms_task_owner(task_id,user_id,sort_order) VALUES(?,?,?) RETURNING task_id AS id').run(id(r.id), owner(user), i)
      }
      for (const r of d.bugs) await business('bugs', r, { title: r.title, description: description(r), source_type: r.source_type, project_id: id(r.project_id), requirement_id: id(r.requirement_id), bug_type_id: archiveId('BT001'), severity: r.severity, status: r.status, assignee_id: owner(r.assignee_id), resolution_id: r.resolved_date ? archiveId('BR001') : null, resolved_date: r.resolved_date, closed_date: r.closed_date, activation_reason: r.activation_reason || null })
      for (const r of d.contracts) await business('contracts', r, { project_id: id(r.project_id), contract_code: `TWIN-${r.contract_code}`, contract_name: `${r.name}（模拟）`, supplier_id: id(r.supplier_id), signed_date: r.signed_date, contract_amount: r.contract_amount, remark: '虚构项目供应商付款合同；不是收入。' })
      for (const r of d.paymentStages) await business('paymentStages', r, { contract_id: id(r.contract_id), stage_name: r.stage_name, planned_amount: r.planned_amount, sort_order: r.sort_order })
      for (const r of d.payments) await business('payments', r, { stage_id: id(r.stage_id), payment_amount: r.payment_amount, payment_month: r.payment_month, handler_id: owner(r.handler_id), remark: `【模拟】${r.remark}` })
      for (const r of d.maintenance) await business('maintenance', r, { product_id: id(r.product_id), previous_contract_id: id(r.previous_contract_id), contract_code: `TWIN-${r.contract_code}`, contract_name: `${r.name}（模拟）`, supplier_id: id(r.supplier_id), signed_date: r.signed_date, service_start_date: r.service_start_date, service_end_date: r.service_end_date, contract_amount: r.contract_amount, remark: `【模拟】${r.remark}` })
      for (const r of d.orders) await business('orders', r, { product_id: id(r.product_id), problem_type: archiveId('PT003'), problem_desc: `<p>【模拟】${r.problem_desc}</p>`, follower_id: owner(r.follower_id), urgency: r.urgency, status: r.status, is_overdue: calculateOverdue('work_order', { date: r.expected_resolve_date, status: r.status }, today).isOverdue, expected_resolve_date: r.expected_resolve_date, resolve_date: r.resolve_date, result_desc: r.result_desc || null, submitter_name: r.submitter_name, submitter_dept: r.submitter_dept, submit_time: r.created_at, activation_reason: r.activation_reason || null, suspend_date: r.status === 4 ? '2026-10-07' : null, suspend_reason: r.suspend_reason || null })
      for (const r of d.followups) await business('followups', r, { project_id: id(r.project_id), requirement_id: id(r.requirement_id), task_id: id(r.task_id), content: `【模拟跟进】${r.content}` })
      // Reuse existing private local-file download support; no upload to external OSS.
      for (const e of d.evidence) {
        if (!['contracts','maintenance','planItems'].includes(e.kind)) continue
        const buffer = Buffer.from(e.content, 'utf8')
        const delivery = e.kind === 'planItems'
        const root = delivery ? files.PROJECT_PLAN_DELIVERY_DIR : files.PRIVATE_ATTACHMENT_DIR
        const stored = await files.saveAttachmentFile({ originalname: e.name, mimetype: 'text/markdown', size: buffer.length, buffer }, root)
        savedFiles.push({ name: stored.storageName, root })
        if (delivery) await insert('pms_project_plan_delivery_file', { plan_item_id: id(e.target_id), original_name: e.name, storage_key: stored.storageName, mime_type: 'text/markdown', size_bytes: buffer.length, uploader_id: owner(e.uploader_id), created_at: e.created_at })
        else await insert(e.kind === 'contracts' ? 'pms_project_contract_attachment' : 'pms_product_maintenance_contract_attachment', { contract_id: id(e.target_id), original_name: e.name, storage_name: stored.storageName, mime_type: 'text/markdown', file_size: buffer.length, creator_id: users[0].id, updater_id: users[0].id, created_at: e.created_at, updated_at: e.created_at })
      }
      const moduleNames = { products: '产品', requirements: '需求', projects: '项目', tasks: '任务', bugs: 'BUG', orders: '运维工单', planItems: '项目阶段主计划', planStages: '项目阶段主计划' }
      async function log(kind, r, action, changes, at) {
        const operationId = randomUUID()
        for (const c of changes.length ? changes : [{ field: null, old: null, value: null }]) await insert('pms_op_log', { user_id: users[0].id, action, module: moduleNames[kind], target_id: id(r.id), target_name: `【模拟】${M.name(r)}`, operation_id: operationId, field_name: c.field, old_value: c.old == null ? null : String(c.old), new_value: c.value == null ? null : String(c.value), ip: 'local-demo-seed', created_at: at })
      }
      // Historical patches are explicitly simulated, while status action names retain existing resume logic.
      for (const [kind] of Object.entries(moduleNames)) for (const r of d[kind]) {
        await log(kind, r, '新增（模拟导入）', [], r.created_at)
        const state = { status: r.status_initial ?? 0, expected_end_date: r.expected_end_date_initial || r.expected_end_date, current_due_date: r.current_due_date_initial || r.current_due_date, risk_text: '', progress_text: r.progress_text_initial || '' }
        for (const e of d.events.filter(e => e.kind === kind && e.target_id === r.id).sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) {
          const changes = Object.entries(e.patch).filter(([key,value]) => String(state[key] ?? '') !== String(value ?? '')).map(([field,value]) => ({ field, old: state[field], value }))
          if (changes.length) await log(kind, r, 'status' in e.patch ? '状态变更' : '编辑（模拟历史）', changes, e.at)
          Object.assign(state, e.patch)
        }
        if (state.status !== r.status && r.status !== undefined) await log(kind, r, '状态变更', [{field:'status',old:state.status,value:r.status}], timestamp(r))
      }
      for (const r of d.contracts) await log('projects', rowById.get(r.project_id), '新增合同（模拟）', [], r.created_at)
      for (const r of d.payments) {
        const c = rowById.get(rowById.get(r.stage_id).contract_id)
        await log('projects', rowById.get(c.project_id), '登记付款（模拟）', [{ field: 'payment', old: null, value: `${r.remark}｜${r.payment_amount.toFixed(2)}` }], r.created_at)
      }
      for (const r of d.maintenance) await log('products', d.products[0], r.previous_contract_id ? '续签运维合同（模拟）' : '新增运维合同（模拟）', [], r.created_at)
      const productId = id(d.products[0].id)
      return { productId, productName: PRODUCT_NAME, hash, ids: Object.fromEntries(ids), files: savedFiles.length, userMapping: d.people.map((p,i) => ({ simulatedPerson: p.name, localOwner: users[i].real_name })), expected: M.summary(d, d.meta.as_of) }
    })
  } catch (error) {
    // A known rollback can remove only the files created by this attempt. Preserve files if commit outcome is unknown.
    if (!error.transactionOutcomeUnknown) for (const file of savedFiles) await files.removeAttachmentFile(file.name, file.root)
    throw error
  } finally { await db.pool.end() }
}
async function main() {
  const args = process.argv.slice(2)
  assert.ok(args.every(a => ['--apply', '--local-only', '--check'].includes(a)), '不支持的参数')
  assert.ok(!args.includes('--apply') || args.includes('--local-only'), '写入必须显式指定 --apply --local-only')
  const d = JSON.parse(await fs.readFile(FIXTURE, 'utf8'))
  const result = await seed(d, args.includes('--apply'))
  if (result.ids) {
    const output = path.resolve(__dirname, '../../artifacts/digital-twin/demo-import.json')
    await fs.mkdir(path.dirname(output), { recursive: true })
    await fs.writeFile(output, JSON.stringify({ ...result, importedAt: new Date().toISOString(), simulation: true }, null, 2) + '\n')
  }
  console.log(JSON.stringify(result, null, 2))
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { assertLocal, validateFixture, seed, PRODUCT_NAME }
