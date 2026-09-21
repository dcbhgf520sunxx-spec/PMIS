const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
test('真实数据库：任意状态转项目、换绑、删除、原子失败与历史补齐幂等', { skip: process.env.RUN_TRANSFER_INTEGRATION !== '1' }, async () => {
  const db = require('../src/db')
  const project = require('../src/controllers/projectController')
  const requirement = require('../src/controllers/requirementController')
  const rollback = new Error('rollback test fixtures')
  try {
    await db.withTransaction(async tx => {
      const user = await tx.prepare('SELECT id FROM pms_user WHERE status=1 AND is_deleted=0 LIMIT 1').get()
      const product = await tx.prepare('SELECT id FROM pms_product WHERE status=1 AND is_deleted=0 LIMIT 1').get()
      assert.ok(user && product)
      const context = { user, ip: '127.0.0.1', requestId: 'transfer-integration' }
      const call = async (handler, body, id) => {
        let response; let sent = 0
        const res = { locals: {}, status() { return this }, json(value) { assert.equal(++sent, 1, '只允许返回一次响应'); response = value; return this } }
        await handler({ ...context, body, params: id ? { id } : {} }, res)
        return response
      }
      assert.equal((await call(project.remove, {}, 999999999)).code, 404)
      assert.equal((await call(project.update, {}, 999999999)).code, 404)
      const createRequirement = async (status) => {
        const r = await tx.prepare(`INSERT INTO pms_requirement(title,requirement_type,product_id,owner_id,status,submitter_name,submit_date,expected_end_date,creator_id,updater_id) VALUES(?,4,?,?,?,'测试',CURRENT_DATE,'2020-01-01',?,?)`).run(`转项测试-${status}-${Date.now()}-${Math.random()}`, product.id, user.id, status, user.id, user.id)
        return r.lastInsertRowid
      }
      const body = id => ({ name: `转项项目-${id}`, product_id: product.id, requirement_id: id, owner_id: user.id, expected_end_date: '2026-12-31', member_ids: [] })
      for (const status of [0, 3, 13, 22, 30, 31, 32, 33, 34, 35]) {
        const id = await createRequirement(status)
        const result = await call(project.create, body(id))
        assert.equal(result.code, 0, JSON.stringify(result))
        const row = await tx.prepare('SELECT status,is_overdue FROM pms_requirement WHERE id=?').get(id)
        assert.equal(row.status, 36); assert.equal(row.is_overdue, null)
        const reject = await call(requirement.toggleStatus, { status: 30 }, id)
        assert.equal(reject.code, 400)
        const invalid = await call(project.remove, {}, result.data.id)
        assert.equal(invalid.code, 400)
        assert.equal((await tx.prepare('SELECT is_deleted FROM pms_project WHERE id=?').get(result.data.id)).is_deleted, 0)
        const nextId = await createRequirement(35)
        const before = await call(project.update, body(nextId), result.data.id)
        assert.equal(before.code, 400)
        assert.equal((await tx.prepare('SELECT status FROM pms_requirement WHERE id=?').get(nextId)).status, 35)
        const rebind = await call(project.update, { ...body(nextId), requirement_release: { status: 31 } }, result.data.id)
        assert.equal(rebind.code, 0, JSON.stringify(rebind))
        assert.equal((await tx.prepare('SELECT status FROM pms_requirement WHERE id=?').get(id)).status, 31)
        assert.equal((await tx.prepare('SELECT status FROM pms_requirement WHERE id=?').get(nextId)).status, 36)
        const removed = await call(project.remove, { requirement_release: { status: 35, pause_date: '2026-09-21', pause_reason: '人工选择暂停' } }, result.data.id)
        assert.equal(removed.code, 0, JSON.stringify(removed))
        assert.equal((await tx.prepare('SELECT status FROM pms_requirement WHERE id=?').get(nextId)).status, 35)
        assert.ok(Number((await tx.prepare("SELECT count(*) n FROM pms_op_log WHERE module='需求' AND target_id=? AND field_name='status'").get(nextId)).n) >= 2)
      }
      const source = await createRequirement(33)
      const made = await call(project.create, body(source))
      assert.equal(made.code, 0)
      await tx.prepare("UPDATE pms_requirement SET status=33,completion_status='历史完成信息' WHERE id=?").run(source)
      const migration = readFileSync(path.join(__dirname, '../db/migrations/20260921_01_requirement_project_transfer.sql'), 'utf8')
      await tx.query(migration)
      const count = Number((await tx.prepare("SELECT count(*) n FROM pms_op_log WHERE target_id=? AND action='历史转项目状态补齐'").get(source)).n)
      assert.ok(count >= 2)
      await tx.query(migration)
      assert.equal(Number((await tx.prepare("SELECT count(*) n FROM pms_op_log WHERE target_id=? AND action='历史转项目状态补齐'").get(source)).n), count)
      assert.equal((await tx.prepare('SELECT completion_status FROM pms_requirement WHERE id=?').get(source)).completion_status, '历史完成信息')
      throw rollback
    })
  } catch (error) { if (error !== rollback) throw error }
  finally { await db.pool.end() }
})
