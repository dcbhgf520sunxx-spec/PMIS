const db = require('../db')
const { fail, failField, ok } = require('../utils/response')
const { buildFollowUpHistoryLog, normalizeFollowUpContent, resolveFollowUpTarget } = require('../services/followUpRecordRules')

const TARGET_NAMES = {
  project: 'name',
  requirement: 'title',
  task: 'name',
}

function contentOrFail(res, value) {
  try {
    return normalizeFollowUpContent(value)
  } catch (error) {
    failField(res, 'content', error.message)
    return null
  }
}

function targetFor(type, rawId) {
  return { ...resolveFollowUpTarget(type, rawId), nameColumn: TARGET_NAMES[type] }
}

async function findTarget(database, target) {
  return database.prepare(
    `SELECT id, ${target.nameColumn} AS name FROM ${target.table} WHERE id = ? AND is_deleted = 0`
  ).get(target.id)
}

async function findRecord(database, target, followUpId) {
  return database.prepare(`SELECT f.*, target.${target.nameColumn} AS target_name
    FROM pms_follow_up_record f
    JOIN ${target.table} target ON target.id = f.${target.column} AND target.is_deleted = 0
    WHERE f.id = ? AND f.${target.column} = ? AND f.is_deleted = 0`).get(followUpId, target.id)
}

function forTarget(type, database = db) {
  return {
    list: async (req, res) => {
      try {
        const target = targetFor(type, req.params.id)
        if (!await findTarget(database, target)) return fail(res, 404, 404, `${target.module}不存在`)
        const rows = await database.prepare(`SELECT f.id, f.content, f.creator_id, creator.real_name AS creator_name,
            f.updater_id, updater.real_name AS updater_name, f.created_at, f.updated_at
          FROM pms_follow_up_record f
          JOIN ${target.table} target ON target.id = f.${target.column} AND target.is_deleted = 0
          LEFT JOIN pms_user creator ON creator.id = f.creator_id
          LEFT JOIN pms_user updater ON updater.id = f.updater_id
          WHERE f.${target.column} = ? AND f.is_deleted = 0
          ORDER BY f.created_at DESC, f.id DESC`).all(target.id)
        ok(res, rows)
      } catch (error) {
        console.error(error)
        fail(res, 500, 500, '查询跟进记录失败')
      }
    },
    create: async (req, res) => {
      const content = contentOrFail(res, req.body.content)
      if (content === null) return
      try {
        const target = targetFor(type, req.params.id)
        const followUpId = await database.transaction(async (tx) => {
          const row = await findTarget(tx, target)
          if (!row) return null
          const result = await tx.prepare(`INSERT INTO pms_follow_up_record
            (${target.column}, content, creator_id, updater_id) VALUES (?, ?, ?, ?)`
          ).run(target.id, content, req.user.id, req.user.id)
          const history = buildFollowUpHistoryLog(target, 'create', null, content)
          await tx.writeLog(req.user.id, history.action, history.module, history.targetId, history.fieldName, history.oldValue, history.newValue, req.ip, row.name)
          return result.lastInsertRowid
        })
        if (!followUpId) return fail(res, 404, 404, `${target.module}不存在`)
        ok(res, { id: followUpId })
      } catch (error) {
        console.error(error)
        fail(res, 500, 500, '新增跟进记录失败')
      }
    },
    update: async (req, res) => {
      const content = contentOrFail(res, req.body.content)
      if (content === null) return
      try {
        const target = targetFor(type, req.params.id)
        const updated = await database.transaction(async (tx) => {
          const row = await findRecord(tx, target, req.params.followUpId)
          if (!row) return false
          if (row.content === content) return true
          await tx.prepare('UPDATE pms_follow_up_record SET content = ?, updater_id = ?, updated_at = NOW() WHERE id = ?')
            .run(content, req.user.id, row.id)
          const history = buildFollowUpHistoryLog(target, 'update', row.content, content)
          await tx.writeLog(req.user.id, history.action, history.module, history.targetId, history.fieldName, history.oldValue, history.newValue, req.ip, row.target_name)
          return true
        })
        if (!updated) return fail(res, 404, 404, '跟进记录不存在')
        ok(res, null)
      } catch (error) {
        console.error(error)
        fail(res, 500, 500, '修改跟进记录失败')
      }
    },
    remove: async (req, res) => {
      try {
        const target = targetFor(type, req.params.id)
        const removed = await database.transaction(async (tx) => {
          const row = await findRecord(tx, target, req.params.followUpId)
          if (!row) return false
          await tx.prepare('UPDATE pms_follow_up_record SET is_deleted = 1, updater_id = ?, updated_at = NOW() WHERE id = ?')
            .run(req.user.id, row.id)
          const history = buildFollowUpHistoryLog(target, 'remove', row.content, null)
          await tx.writeLog(req.user.id, history.action, history.module, history.targetId, history.fieldName, history.oldValue, history.newValue, req.ip, row.target_name)
          return true
        })
        if (!removed) return fail(res, 404, 404, '跟进记录不存在')
        ok(res, null)
      } catch (error) {
        console.error(error)
        fail(res, 500, 500, '删除跟进记录失败')
      }
    },
  }
}

exports.forTarget = forTarget
