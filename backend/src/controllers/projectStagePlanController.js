const db = require('../db')
const fs = require('node:fs')
const path = require('node:path')
const { fail, failField, ok } = require('../utils/response')
const {
  PLAN_ITEM_STATUS,
  allowedPlanItemStatuses,
  validatePlanItemStatusChange,
  validatePlanAdjustmentReason,
  getPlanItemProgressHint,
} = require('../services/projectStagePlanRules')
const {
  normalizeOriginalName,
  removeAttachmentFile,
  resolveAttachmentPath,
  saveAttachmentFile,
} = require('../services/projectContractAttachmentService')
const {
  appendLegacyAdjustmentReasons,
  buildProjectStagePlanHistory,
  resolveMovedPlanRow,
} = require('../services/projectStagePlanHistory')

const DELIVERY_ROOT = path.join(__dirname, '../../private-uploads/project-plan-deliveries')

async function findProject(projectId) {
  return db.prepare('SELECT id,name FROM pms_project WHERE id=? AND is_deleted=0').get(projectId)
}

async function findStage(projectId, stageId) {
  return db.prepare(`SELECT s.*,p.name project_name FROM pms_project_plan_stage s
    JOIN pms_project p ON p.id=s.project_id AND p.is_deleted=0
    WHERE s.id=? AND s.project_id=? AND s.is_deleted=0`).get(stageId, projectId)
}

async function findItem(projectId, itemId) {
  return db.prepare(`SELECT i.*,s.project_id,s.name stage_name,p.name project_name,u.real_name owner_name
    FROM pms_project_plan_item i
    JOIN pms_project_plan_stage s ON s.id=i.stage_id AND s.is_deleted=0
    JOIN pms_project p ON p.id=s.project_id AND p.is_deleted=0
    JOIN pms_user u ON u.id=i.owner_id
    WHERE i.id=? AND s.project_id=? AND i.is_deleted=0`).get(itemId, projectId)
}

function normalizeIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
}

async function validateItem(res, projectId, body, excludeItemId) {
  const stage = await findStage(projectId, body.stage_id)
  if (!stage) {
    failField(res, 'stage_id', '所属阶段不存在')
    return null
  }
  const name = String(body.name || '').trim()
  if (!name) {
    failField(res, 'name', '请填写关键事项名称')
    return null
  }
  if (name.length > 200) {
    failField(res, 'name', '关键事项名称不能超过200个字符')
    return null
  }
  if (!body.owner_id) {
    failField(res, 'owner_id', '请选择主负责人')
    return null
  }
  const owner = await db.prepare('SELECT id FROM pms_user WHERE id=? AND status=1 AND is_deleted=0').get(body.owner_id)
  if (!owner) {
    failField(res, 'owner_id', '主负责人不存在或已停用')
    return null
  }
  const collaboratorIds = normalizeIds(body.collaborator_ids)
  if (collaboratorIds.includes(Number(body.owner_id))) {
    failField(res, 'collaborator_ids', '协作人不能包含主负责人')
    return null
  }
  if (collaboratorIds.length) {
    const count = await db.prepare(`SELECT COUNT(*) count FROM pms_user WHERE id IN (${collaboratorIds.map(() => '?').join(',')}) AND status=1 AND is_deleted=0`).get(...collaboratorIds)
    if (Number(count.count) !== collaboratorIds.length) {
      failField(res, 'collaborator_ids', '部分协作人不存在或已停用')
      return null
    }
  }
  const duplicate = excludeItemId
    ? await db.prepare('SELECT id FROM pms_project_plan_item WHERE stage_id=? AND name=? AND is_deleted=0 AND id<>?').get(stage.id, name, excludeItemId)
    : await db.prepare('SELECT id FROM pms_project_plan_item WHERE stage_id=? AND name=? AND is_deleted=0').get(stage.id, name)
  if (duplicate) {
    failField(res, 'name', '当前阶段已存在同名关键事项')
    return null
  }
  return { stage, name, collaboratorIds }
}

async function saveCollaborators(tx, itemId, ids) {
  await tx.prepare('DELETE FROM pms_project_plan_item_collaborator WHERE plan_item_id=?').run(itemId)
  for (const [index, userId] of ids.entries()) {
    await tx.prepare('INSERT INTO pms_project_plan_item_collaborator(plan_item_id,user_id,sort_order)VALUES(?,?,?) RETURNING plan_item_id AS id').run(itemId, userId, index)
  }
}

exports.getPlan = async (req, res) => {
  try {
    const project = await findProject(req.params.projectId)
    if (!project) return fail(res, 404, 404, '项目不存在')
    const stages = await db.prepare(`SELECT s.id,s.project_id,s.name,s.description,s.sort_order,
      COUNT(i.id)::INTEGER item_count,
      COUNT(i.id) FILTER(WHERE i.status=2)::INTEGER completed_count,
      MIN(i.current_due_date) min_due_date,MAX(i.current_due_date) max_due_date,
      COUNT(i.id) FILTER(WHERE i.status IN(0,1) AND i.current_due_date<CURRENT_DATE)::INTEGER overdue_count
      FROM pms_project_plan_stage s
      LEFT JOIN pms_project_plan_item i ON i.stage_id=s.id AND i.is_deleted=0
      WHERE s.project_id=? AND s.is_deleted=0
      GROUP BY s.id ORDER BY s.sort_order,s.id`).all(project.id)
    const items = await db.prepare(`SELECT i.*,s.project_id,u.real_name owner_name,
      COALESCE((SELECT json_agg(json_build_object('id',c.user_id,'name',cu.real_name) ORDER BY c.sort_order,c.user_id)
        FROM pms_project_plan_item_collaborator c JOIN pms_user cu ON cu.id=c.user_id WHERE c.plan_item_id=i.id),'[]'::json) collaborators,
      (SELECT COUNT(*)::INTEGER FROM pms_project_plan_adjustment a WHERE a.plan_item_id=i.id) adjustment_count,
      (SELECT COUNT(*)::INTEGER FROM pms_project_plan_delivery_file f WHERE f.plan_item_id=i.id AND f.is_current=1 AND f.is_void=0) file_count
      FROM pms_project_plan_item i JOIN pms_project_plan_stage s ON s.id=i.stage_id
      JOIN pms_user u ON u.id=i.owner_id
      WHERE s.project_id=? AND s.is_deleted=0 AND i.is_deleted=0
      ORDER BY i.stage_id,i.sort_order,i.id`).all(project.id)
    const byStage = new Map()
    for (const item of items) {
      item.progress_hint = getPlanItemProgressHint(item)
      if (!byStage.has(String(item.stage_id))) byStage.set(String(item.stage_id), [])
      byStage.get(String(item.stage_id)).push(item)
    }
    ok(res, { project, stages: stages.map((stage) => ({ ...stage, items: byStage.get(String(stage.id)) || [] })) })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询阶段主计划失败')
  }
}

exports.history = async (req, res) => {
  try {
    const project = await findProject(req.params.projectId)
    if (!project) return fail(res, 404, 404, '项目不存在')
    const stageActions = ['新增阶段', '编辑阶段', '调整阶段顺序', '删除阶段']
    const actionPlaceholders = stageActions.map(() => '?').join(',')
    const logs = await db.prepare(`SELECT l.id,l.operation_id,l.action,l.target_name,l.field_name,l.old_value,l.new_value,l.created_at,
      COALESCE(u.real_name,'-') operator
      FROM pms_op_log l
      LEFT JOIN pms_user u ON u.id=l.user_id
      WHERE l.module='项目阶段主计划' AND (
        (l.action IN(${actionPlaceholders}) AND EXISTS(
          SELECT 1 FROM pms_project_plan_stage s WHERE s.id=l.target_id AND s.project_id=?
        ))
        OR
        (l.action NOT IN(${actionPlaceholders}) AND EXISTS(
          SELECT 1 FROM pms_project_plan_item i
          JOIN pms_project_plan_stage s ON s.id=i.stage_id
          WHERE i.id=l.target_id AND s.project_id=?
        ))
      )
      ORDER BY l.created_at DESC,l.id DESC`).all(...stageActions, project.id, ...stageActions, project.id)
    const [stages, adjustments] = await Promise.all([
      db.prepare('SELECT id,name FROM pms_project_plan_stage WHERE project_id=?').all(project.id),
      db.prepare(`SELECT a.plan_item_id,a.new_due_date,a.reason,a.created_at
        FROM pms_project_plan_adjustment a
        JOIN pms_project_plan_item i ON i.id=a.plan_item_id
        JOIN pms_project_plan_stage s ON s.id=i.stage_id
        WHERE s.project_id=?`).all(project.id),
    ])
    const enrichedLogs = appendLegacyAdjustmentReasons(logs, adjustments)
    const userIds = [...new Set(enrichedLogs.filter((log) => ['owner_id', 'collaborator_ids'].includes(log.field_name)).flatMap((log) => {
      if (log.field_name === 'collaborator_ids') return `${log.old_value || ''},${log.new_value || ''}`.split(',')
      return [log.old_value, log.new_value]
    }).map(Number).filter(Number.isFinite))]
    const users = userIds.length
      ? await db.prepare(`SELECT id,real_name FROM pms_user WHERE id IN(${userIds.map(() => '?').join(',')})`).all(...userIds)
      : []
    ok(res, buildProjectStagePlanHistory(enrichedLogs, {
      stageLookup: new Map(stages.map((stage) => [String(stage.id), stage.name])),
      userLookup: new Map(users.map((user) => [String(user.id), user.real_name])),
    }))
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询阶段主计划变更历史失败')
  }
}

exports.createStage = async (req, res) => {
  try {
    const project = await findProject(req.params.projectId)
    if (!project) return fail(res, 404, 404, '项目不存在')
    const name = String(req.body.name || '').trim()
    if (!name) return failField(res, 'name', '请填写阶段名称')
    if (name.length > 100) return failField(res, 'name', '阶段名称不能超过100个字符')
    if (await db.prepare('SELECT id FROM pms_project_plan_stage WHERE project_id=? AND name=? AND is_deleted=0').get(project.id, name)) {
      return failField(res, 'name', '阶段名称已存在')
    }
    const order = await db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 sort_order FROM pms_project_plan_stage WHERE project_id=? AND is_deleted=0').get(project.id)
    const result = await db.prepare(`INSERT INTO pms_project_plan_stage(project_id,name,description,sort_order,creator_id,updater_id)
      VALUES(?,?,?,?,?,?)`).run(project.id, name, req.body.description || null, order.sort_order, req.user.id, req.user.id)
    await db.writeLog(req.user.id, '新增阶段', '项目阶段主计划', result.lastInsertRowid, null, null, name, req.ip, name)
    ok(res, { id: result.lastInsertRowid })
  } catch (error) {
    if (error.code === '23505') return failField(res, 'name', '阶段名称已存在')
    console.error(error)
    fail(res, 500, 500, '新增阶段失败')
  }
}

exports.updateStage = async (req, res) => {
  try {
    const stage = await findStage(req.params.projectId, req.params.stageId)
    if (!stage) return fail(res, 404, 404, '阶段不存在')
    const name = String(req.body.name || '').trim()
    if (!name) return failField(res, 'name', '请填写阶段名称')
    const duplicate = await db.prepare('SELECT id FROM pms_project_plan_stage WHERE project_id=? AND name=? AND is_deleted=0 AND id<>?').get(stage.project_id, name, stage.id)
    if (duplicate) return failField(res, 'name', '阶段名称已存在')
    await db.prepare('UPDATE pms_project_plan_stage SET name=?,description=?,updater_id=?,updated_at=NOW()WHERE id=?').run(name, req.body.description || null, req.user.id, stage.id)
    await db.writeLogs(req.user.id, '编辑阶段', '项目阶段主计划', stage.id, [
      { field: 'name', oldVal: stage.name, newVal: name },
      { field: 'description', oldVal: stage.description, newVal: req.body.description || null },
    ], req.ip, name)
    ok(res, null)
  } catch (error) {
    if (error.code === '23505') return failField(res, 'name', '阶段名称已存在')
    console.error(error)
    fail(res, 500, 500, '编辑阶段失败')
  }
}

exports.reorderStages = async (req, res) => {
  try {
    const ids = normalizeIds(req.body.ids)
    const rows = await db.prepare('SELECT id,name,sort_order FROM pms_project_plan_stage WHERE project_id=? AND is_deleted=0 ORDER BY sort_order,id').all(req.params.projectId)
    if (ids.length !== rows.length || new Set(ids).size !== rows.length || rows.some((row) => !ids.includes(Number(row.id)))) {
      return fail(res, 400, 400, '阶段排序数据已变化，请刷新后重试')
    }
    const moved = resolveMovedPlanRow(rows, ids, req.body.moved_id)
    await db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) await tx.prepare('UPDATE pms_project_plan_stage SET sort_order=?,updater_id=?,updated_at=NOW()WHERE id=?').run(index, req.user.id, id)
    })
    if (moved) await db.writeLog(req.user.id, '调整阶段顺序', '项目阶段主计划', moved.id, 'sort_order', moved.oldPosition, moved.newPosition, req.ip, moved.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '保存阶段排序失败')
  }
}

exports.deleteStage = async (req, res) => {
  try {
    const stage = await findStage(req.params.projectId, req.params.stageId)
    if (!stage) return fail(res, 404, 404, '阶段不存在')
    const count = await db.prepare('SELECT COUNT(*) count FROM pms_project_plan_item WHERE stage_id=? AND is_deleted=0').get(stage.id)
    if (Number(count.count)) return fail(res, 400, 400, '阶段下存在关键事项，不能删除')
    await db.prepare('UPDATE pms_project_plan_stage SET is_deleted=1,updater_id=?,updated_at=NOW()WHERE id=?').run(req.user.id, stage.id)
    await db.writeLog(req.user.id, '删除阶段', '项目阶段主计划', stage.id, 'is_deleted', 0, 1, req.ip, stage.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '删除阶段失败')
  }
}

exports.createItem = async (req, res) => {
  try {
    const validated = await validateItem(res, req.params.projectId, req.body)
    if (!validated) return
    if (!req.body.original_due_date) return failField(res, 'original_due_date', '请选择计划完成时间')
    const order = await db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 sort_order FROM pms_project_plan_item WHERE stage_id=? AND is_deleted=0').get(validated.stage.id)
    const itemId = await db.transaction(async (tx) => {
      const result = await tx.prepare(`INSERT INTO pms_project_plan_item
        (stage_id,name,owner_id,original_due_date,current_due_date,requires_delivery_file,delivery_requirement,remark,sort_order,creator_id,updater_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(validated.stage.id, validated.name, req.body.owner_id, req.body.original_due_date, req.body.original_due_date,
        Number(req.body.requires_delivery_file) === 1 ? 1 : 0, Number(req.body.requires_delivery_file) === 1 ? '关键交付文件' : null,
        req.body.remark || null, order.sort_order, req.user.id, req.user.id)
      await saveCollaborators(tx, result.lastInsertRowid, validated.collaboratorIds)
      return result.lastInsertRowid
    })
    await db.writeLog(req.user.id, '新增关键事项', '项目阶段主计划', itemId, null, null, validated.name, req.ip, validated.name)
    ok(res, { id: itemId })
  } catch (error) {
    if (error.code === '23505') return failField(res, 'name', '当前阶段已存在同名关键事项')
    console.error(error)
    fail(res, 500, 500, '新增关键事项失败')
  }
}

exports.createItems = async (req, res) => {
  try {
    const stageId = req.body.stage_id
    const items = Array.isArray(req.body.items) ? req.body.items : []
    if (!items.length) return fail(res, 400, 400, '请至少填写一条关键事项')
    const stage = await findStage(req.params.projectId, stageId)
    if (!stage) return failField(res, 'stage_id', '所属阶段不存在')

    const validatedItems = []
    const names = new Set()
    for (const item of items) {
      const body = { ...item, stage_id: stage.id }
      const validated = await validateItem(res, req.params.projectId, body)
      if (!validated) return
      if (!body.original_due_date) return failField(res, 'original_due_date', '请选择计划完成时间')
      if (names.has(validated.name)) return failField(res, 'name', '本次新增存在同名关键事项')
      names.add(validated.name)
      validatedItems.push({ body, validated })
    }

    const order = await db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 sort_order FROM pms_project_plan_item WHERE stage_id=? AND is_deleted=0').get(stage.id)
    const ids = await db.transaction(async (tx) => {
      const createdIds = []
      for (const [index, entry] of validatedItems.entries()) {
        const result = await tx.prepare(`INSERT INTO pms_project_plan_item
          (stage_id,name,owner_id,original_due_date,current_due_date,requires_delivery_file,delivery_requirement,remark,sort_order,creator_id,updater_id)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(stage.id, entry.validated.name, entry.body.owner_id, entry.body.original_due_date, entry.body.original_due_date,
          Number(entry.body.requires_delivery_file) === 1 ? 1 : 0, Number(entry.body.requires_delivery_file) === 1 ? '关键交付文件' : null,
          entry.body.remark || null,
          Number(order.sort_order) + index, req.user.id, req.user.id)
        await saveCollaborators(tx, result.lastInsertRowid, entry.validated.collaboratorIds)
        createdIds.push(Number(result.lastInsertRowid))
      }
      return createdIds
    })
    for (const [index, id] of ids.entries()) {
      await db.writeLog(req.user.id, '新增关键事项', '项目阶段主计划', id, null, null, validatedItems[index].validated.name, req.ip, validatedItems[index].validated.name)
    }
    ok(res, { ids })
  } catch (error) {
    if (error.code === '23505') return failField(res, 'name', '当前阶段已存在同名关键事项')
    console.error(error)
    fail(res, 500, 500, '批量新增关键事项失败')
  }
}

exports.updateItem = async (req, res) => {
  try {
    const old = await findItem(req.params.projectId, req.params.itemId)
    if (!old) return fail(res, 404, 404, '关键事项不存在')
    const validated = await validateItem(res, req.params.projectId, req.body, old.id)
    if (!validated) return
    if (Number(old.status) === PLAN_ITEM_STATUS.COMPLETED && Number(old.requires_delivery_file) === 0 && Number(req.body.requires_delivery_file) === 1) {
      const count = await db.prepare('SELECT COUNT(*) count FROM pms_project_plan_delivery_file WHERE plan_item_id=? AND is_current=1 AND is_void=0').get(old.id)
      if (!Number(count.count)) return fail(res, 400, 400, '已完成事项改为需要交付文件前，请先上传文件')
    }
    const oldCollaborators = await db.prepare('SELECT user_id FROM pms_project_plan_item_collaborator WHERE plan_item_id=? ORDER BY sort_order,user_id').all(old.id)
    const oldCollaboratorIds = oldCollaborators.map((row) => Number(row.user_id)).sort((a, b) => a - b).join(',')
    const newCollaboratorIds = [...validated.collaboratorIds].sort((a, b) => a - b).join(',')
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE pms_project_plan_item SET stage_id=?,name=?,owner_id=?,requires_delivery_file=?,delivery_requirement=?,remark=?,updater_id=?,updated_at=NOW()WHERE id=?`)
        .run(validated.stage.id, validated.name, req.body.owner_id, Number(req.body.requires_delivery_file) === 1 ? 1 : 0,
          Number(req.body.requires_delivery_file) === 1 ? '关键交付文件' : null, req.body.remark || null, req.user.id, old.id)
      await saveCollaborators(tx, old.id, validated.collaboratorIds)
    })
    await db.writeLogs(req.user.id, '编辑关键事项', '项目阶段主计划', old.id, [
      { field: 'stage_id', oldVal: old.stage_id, newVal: validated.stage.id },
      { field: 'name', oldVal: old.name, newVal: validated.name },
      { field: 'owner_id', oldVal: old.owner_id, newVal: req.body.owner_id },
      { field: 'collaborator_ids', oldVal: oldCollaboratorIds, newVal: newCollaboratorIds },
      { field: 'requires_delivery_file', oldVal: old.requires_delivery_file, newVal: Number(req.body.requires_delivery_file) === 1 ? 1 : 0 },
      { field: 'remark', oldVal: old.remark, newVal: req.body.remark || null },
    ], req.ip, validated.name)
    ok(res, null)
  } catch (error) {
    if (error.code === '23505') return failField(res, 'name', '当前阶段已存在同名关键事项')
    console.error(error)
    fail(res, 500, 500, '编辑关键事项失败')
  }
}

exports.reorderItems = async (req, res) => {
  try {
    const stage = await findStage(req.params.projectId, req.params.stageId)
    if (!stage) return fail(res, 404, 404, '阶段不存在')
    const ids = normalizeIds(req.body.ids)
    const rows = await db.prepare('SELECT id,name,sort_order FROM pms_project_plan_item WHERE stage_id=? AND is_deleted=0 ORDER BY sort_order,id').all(stage.id)
    if (ids.length !== rows.length || rows.some((row) => !ids.includes(Number(row.id)))) return fail(res, 400, 400, '关键事项排序数据已变化，请刷新后重试')
    const moved = resolveMovedPlanRow(rows, ids, req.body.moved_id)
    await db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) await tx.prepare('UPDATE pms_project_plan_item SET sort_order=?,updater_id=?,updated_at=NOW()WHERE id=?').run(index, req.user.id, id)
    })
    if (moved) await db.writeLog(req.user.id, '调整关键事项顺序', '项目阶段主计划', moved.id, 'sort_order', moved.oldPosition, moved.newPosition, req.ip, moved.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '保存关键事项排序失败')
  }
}

exports.changeStatus = async (req, res) => {
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    const target = Number(req.body.status)
    if (!allowedPlanItemStatuses(item.status, item.previous_status).includes(target)) return fail(res, 400, 400, '不允许执行该状态流转')
    const count = await db.prepare('SELECT COUNT(*) count FROM pms_project_plan_delivery_file WHERE plan_item_id=? AND is_current=1 AND is_void=0').get(item.id)
    const error = validatePlanItemStatusChange(target, req.body, Number(item.requires_delivery_file) === 1, count.count)
    if (error) return fail(res, 400, 400, error)
    const previousStatus = target === PLAN_ITEM_STATUS.PAUSED ? item.status : null
    const pauseReason = target === PLAN_ITEM_STATUS.PAUSED ? String(req.body.pause_reason || '').trim() : null
    const actualEndDate = target === PLAN_ITEM_STATUS.COMPLETED ? req.body.actual_end_date : null
    await db.prepare('UPDATE pms_project_plan_item SET status=?,previous_status=?,actual_end_date=?,pause_reason=?,updater_id=?,updated_at=NOW()WHERE id=?')
      .run(target, previousStatus, actualEndDate, pauseReason, req.user.id, item.id)
    await db.writeLogs(req.user.id, '状态变更', '项目阶段主计划', item.id, [
      { field: 'status', oldVal: item.status, newVal: target },
      { field: 'actual_end_date', oldVal: item.actual_end_date, newVal: actualEndDate },
      { field: 'pause_reason', oldVal: item.pause_reason, newVal: pauseReason },
    ], req.ip, item.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '状态变更失败')
  }
}

exports.createAdjustment = async (req, res) => {
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    if (!req.body.new_due_date) return failField(res, 'new_due_date', '请选择新的计划完成时间')
    const reason = String(req.body.reason || '').trim()
    const reasonError = validatePlanAdjustmentReason(reason)
    if (reasonError) return failField(res, 'reason', reasonError)
    await db.transaction(async (tx) => {
      await tx.prepare('INSERT INTO pms_project_plan_adjustment(plan_item_id,old_due_date,new_due_date,reason,operator_id)VALUES(?,?,?,?,?)')
        .run(item.id, item.current_due_date, req.body.new_due_date, reason, req.user.id)
      await tx.prepare('UPDATE pms_project_plan_item SET current_due_date=?,updater_id=?,updated_at=NOW()WHERE id=?').run(req.body.new_due_date, req.user.id, item.id)
    })
    await db.writeLogs(req.user.id, '调整计划', '项目阶段主计划', item.id, [
      { field: 'current_due_date', oldVal: item.current_due_date, newVal: req.body.new_due_date },
      { field: 'adjustment_reason', oldVal: null, newVal: reason },
    ], req.ip, item.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '调整计划失败')
  }
}

exports.listAdjustments = async (req, res) => {
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    const rows = await db.prepare(`SELECT a.*,u.real_name operator_name FROM pms_project_plan_adjustment a
      LEFT JOIN pms_user u ON u.id=a.operator_id WHERE a.plan_item_id=? ORDER BY a.created_at DESC,a.id DESC`).all(item.id)
    ok(res, rows)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询调整历史失败')
  }
}

exports.deleteItem = async (req, res) => {
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    await db.prepare('UPDATE pms_project_plan_item SET is_deleted=1,updater_id=?,updated_at=NOW()WHERE id=?').run(req.user.id, item.id)
    await db.writeLog(req.user.id, '删除关键事项', '项目阶段主计划', item.id, 'is_deleted', 0, 1, req.ip, item.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '删除关键事项失败')
  }
}

async function listFiles(itemId) {
  return db.prepare(`SELECT f.id,f.plan_item_id,f.original_name,f.mime_type,f.size_bytes,f.created_at,u.real_name uploader_name
    FROM pms_project_plan_delivery_file f LEFT JOIN pms_user u ON u.id=f.uploader_id
    WHERE f.plan_item_id=? AND f.is_current=1 AND f.is_void=0
    ORDER BY f.created_at DESC,f.id DESC`).all(itemId)
}

exports.listFiles = async (req, res) => {
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    ok(res, await listFiles(item.id))
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询交付文件失败')
  }
}

exports.uploadFile = async (req, res) => {
  let saved
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    if (!req.file) return fail(res, 400, 400, '请选择要上传的交付文件')
    req.file.originalname = normalizeOriginalName(req.file.originalname)
    saved = await saveAttachmentFile(req.file, DELIVERY_ROOT)
    const result = await db.prepare(`INSERT INTO pms_project_plan_delivery_file
      (plan_item_id,original_name,storage_key,mime_type,size_bytes,uploader_id)
      VALUES(?,?,?,?,?,?)`).run(item.id, req.file.originalname, saved.storageName, req.file.mimetype, req.file.buffer.length, req.user.id)
    await db.writeLog(req.user.id, '上传交付文件', '项目阶段主计划', item.id, null, null, req.file.originalname, req.ip, item.name)
    ok(res, (await listFiles(item.id)).find((file) => Number(file.id) === Number(result.lastInsertRowid)))
  } catch (error) {
    if (saved) await removeAttachmentFile(saved.storageName, DELIVERY_ROOT).catch(console.error)
    if (error.statusCode === 400) return fail(res, 400, 400, error.message)
    console.error(error)
    fail(res, 500, 500, '上传交付文件失败')
  }
}

exports.deleteFile = async (req, res) => {
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    const file = await db.prepare('SELECT * FROM pms_project_plan_delivery_file WHERE id=? AND plan_item_id=? AND is_current=1 AND is_void=0').get(req.params.fileId, item.id)
    if (!file) return fail(res, 404, 404, '当前交付文件不存在')
    const count = await db.prepare('SELECT COUNT(*) count FROM pms_project_plan_delivery_file WHERE plan_item_id=? AND is_current=1 AND is_void=0').get(item.id)
    if (Number(item.status) === PLAN_ITEM_STATUS.COMPLETED && Number(item.requires_delivery_file) === 1 && Number(count.count) <= 1) {
      return fail(res, 400, 400, '已完成且要求交付文件的事项必须至少保留一个有效文件')
    }
    await db.prepare('UPDATE pms_project_plan_delivery_file SET is_void=1 WHERE id=?').run(file.id)
    await removeAttachmentFile(file.storage_key, DELIVERY_ROOT).catch((error) => {
      if (error.code !== 'ENOENT') console.error(error)
    })
    await db.writeLog(req.user.id, '删除交付文件', '项目阶段主计划', item.id, null, file.original_name, null, req.ip, item.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '删除交付文件失败')
  }
}

exports.downloadFile = async (req, res) => {
  try {
    const item = await findItem(req.params.projectId, req.params.itemId)
    if (!item) return fail(res, 404, 404, '关键事项不存在')
    const file = await db.prepare('SELECT * FROM pms_project_plan_delivery_file WHERE id=? AND plan_item_id=? AND is_current=1 AND is_void=0').get(req.params.fileId, item.id)
    if (!file) return fail(res, 404, 404, '交付文件不存在')
    const filePath = resolveAttachmentPath(file.storage_key, DELIVERY_ROOT)
    await fs.promises.access(filePath)
    res.setHeader('Content-Type', file.mime_type)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`)
    fs.createReadStream(filePath).pipe(res)
  } catch (error) {
    if (error.code === 'ENOENT') return fail(res, 404, 404, '交付文件不存在')
    console.error(error)
    fail(res, 500, 500, '下载交付文件失败')
  }
}
