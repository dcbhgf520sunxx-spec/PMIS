const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')

const enabled = process.env.RUN_DB_INTEGRATION === '1'

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

test('项目合同和分阶段付款真实接口流程', { skip: !enabled }, async () => {
  assert.equal(process.env.INTEGRATION_DB_ISOLATED, '1', '真实集成测试只能连接明确标记的隔离数据库')
  const app = require('../src/app')
  const db = require('../src/db')
  const server = app.listen(0)
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  let token = ''
  const request = async (path, { method = 'GET', body, auth = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { response, body: await readJson(response) }
  }

  try {
    const suffix = Date.now().toString(36)
    const employeeNo = `contract_${suffix}`
    const passwordHash = await bcrypt.hash('vv123456', 10)
    const testUser = await db.prepare(
      'INSERT INTO pms_user (employee_no, real_name, phone, password, status, first_login, creator_id, updater_id) VALUES (?, ?, ?, ?, 1, 1, 1, 1)'
    ).run(employeeNo, '合同集成测试用户', `136${String(Date.now()).slice(-8)}`, passwordHash)
    await db.prepare(
      "INSERT INTO pms_user_role (user_id, role_id) SELECT ?, id FROM pms_role WHERE code = 'admin' AND is_deleted = 0"
    ).run(testUser.lastInsertRowid)

    const login = await request('/api/auth/login', { method: 'POST', auth: false, body: { account: employeeNo, password: 'vv123456' } })
    assert.equal(login.response.status, 200)
    token = login.body.data.token
    const password = await request('/api/auth/password', { method: 'PUT', body: { old_password: 'vv123456', new_password: 'vv1234567' } })
    assert.equal(password.response.status, 200)

    const product = await request('/api/products', { method: 'POST', body: { name: `合同测试产品${suffix}`, owner_id: 1 } })
    assert.equal(product.response.status, 200)
    const project = await request('/api/projects', { method: 'POST', body: { name: `合同测试项目${suffix}`, product_id: product.body.data.id, owner_id: 1, expected_end_date: '2026-12-31' } })
    assert.equal(project.response.status, 200)
    const projectId = project.body.data.id
    const supplierType = await db.prepare("SELECT id FROM pms_archive_type WHERE name = '供应商' AND is_deleted = 0").get()
    const supplier = await request('/api/archives', { method: 'POST', body: { archive_type_id: supplierType.id, name: `测试供应商${suffix}` } })
    assert.equal(supplier.response.status, 200)
    const supplierId = supplier.body.data.id

    const empty = await request(`/api/projects/${projectId}/contract`)
    assert.equal(empty.response.status, 200)
    assert.equal(empty.body.data, null)

    const created = await request(`/api/projects/${projectId}/contract`, { method: 'POST', body: {
      contract_code: `HT-${suffix}`,
      contract_name: '项目建设合同',
      supplier_id: supplierId,
      signed_date: '2026-07-20',
      contract_amount: '100.00',
      remark: '合同集成测试备注',
      stages: [
        { stage_name: '签约款', planned_amount: '50.00' },
        { stage_name: '验收款', planned_amount: '50.00' },
      ],
    } })
    assert.equal(created.response.status, 200)

    const duplicate = await request(`/api/projects/${projectId}/contract`, { method: 'POST', body: {
      contract_code: `HT-${suffix}-2`, contract_name: '重复合同', supplier_id: supplierId, signed_date: '2026-07-20', contract_amount: '100.00',
      stages: [{ stage_name: '全款', planned_amount: '100.00' }],
    } })
    assert.equal(duplicate.response.status, 400)

    const detail = await request(`/api/projects/${projectId}/contract`)
    assert.equal(detail.response.status, 200)
    assert.equal(Number(detail.body.data.supplier_id), Number(supplierId))
    assert.equal(detail.body.data.supplier_name, `测试供应商${suffix}`)
    assert.equal(Number(detail.body.data.paid_amount), 0)
    assert.equal(detail.body.data.remark, '合同集成测试备注')
    assert.equal(detail.body.data.stages.length, 2)
    assert.deepEqual(detail.body.data.attachments, [])
    const stageId = detail.body.data.stages[0].id

    const attachmentForm = new FormData()
    attachmentForm.append('file', new Blob([Buffer.from('%PDF-1.7 integration contract')], { type: 'application/pdf' }), '合同附件.pdf')
    const attachmentResponse = await fetch(`${baseUrl}/api/projects/${projectId}/contract/attachments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: attachmentForm,
    })
    const attachmentBody = await readJson(attachmentResponse)
    assert.equal(attachmentResponse.status, 200)
    assert.equal(attachmentBody.data.original_name, '合同附件.pdf')
    const attachmentId = attachmentBody.data.id

    const withAttachment = await request(`/api/projects/${projectId}/contract`)
    assert.equal(withAttachment.body.data.attachments.length, 1)
    assert.equal(withAttachment.body.data.attachments[0].original_name, '合同附件.pdf')
    const unauthorizedDownload = await fetch(`${baseUrl}/api/projects/${projectId}/contract/attachments/${attachmentId}/download`)
    assert.equal(unauthorizedDownload.status, 401)
    const download = await fetch(`${baseUrl}/api/projects/${projectId}/contract/attachments/${attachmentId}/download`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(download.status, 200)
    assert.match(download.headers.get('content-disposition'), /合同附件\.pdf|%E5%90%88%E5%90%8C%E9%99%84%E4%BB%B6\.pdf/)
    assert.equal(Buffer.from(await download.arrayBuffer()).toString(), '%PDF-1.7 integration contract')

    for (const amount of ['30.00', '20.00']) {
      const payment = await request(`/api/projects/${projectId}/contract/stages/${stageId}/payments`, { method: 'POST', body: { payment_amount: amount, payment_month: '2026-07', handler_id: 1, remark: '集成测试付款' } })
      assert.equal(payment.response.status, 200)
    }
    const paid = await request(`/api/projects/${projectId}/contract`)
    assert.equal(Number(paid.body.data.paid_amount), 50)
    assert.equal(Number(paid.body.data.unpaid_amount), 50)
    assert.equal(Number(paid.body.data.stages[0].payment_status), 2)

    const overpaid = await request(`/api/projects/${projectId}/contract/stages/${stageId}/payments`, { method: 'POST', body: { payment_amount: '0.01', payment_month: '2026-07', handler_id: 1 } })
    assert.equal(overpaid.response.status, 400)
    assert.deepEqual(overpaid.body.fieldErrors.payment_amount, ['本次付款金额不能超过该阶段待付金额'])

    const payments = await request(`/api/projects/${projectId}/contract/stages/${stageId}/payments`)
    assert.equal(payments.response.status, 200)
    assert.equal(payments.body.data.length, 2)

    const changed = await request(`/api/projects/${projectId}/contract/payments/${payments.body.data[0].id}`, { method: 'PUT', body: { payment_amount: '15.00', payment_month: '2026-07', handler_id: 1, remark: '更正金额' } })
    assert.equal(changed.response.status, 200)
    const removed = await request(`/api/projects/${projectId}/contract/payments/${payments.body.data[1].id}`, { method: 'DELETE' })
    assert.equal(removed.response.status, 200)

    const recalculated = await request(`/api/projects/${projectId}/contract`)
    assert.equal(Number(recalculated.body.data.paid_amount), 15)
    assert.equal(Number(recalculated.body.data.stages[0].unpaid_amount), 35)
    assert.equal(Number(recalculated.body.data.stages[0].payment_status), 1)

    const protectedProject = await request(`/api/projects/${projectId}`, { method: 'DELETE' })
    assert.equal(protectedProject.response.status, 400)
    assert.match(protectedProject.body.message, /合同/)
    const protectedSupplier = await request(`/api/archives/${supplierId}`, { method: 'DELETE' })
    assert.equal(protectedSupplier.response.status, 400)
    assert.match(protectedSupplier.body.message, /项目合同/)
    const deletedAttachment = await request(`/api/projects/${projectId}/contract/attachments/${attachmentId}`, { method: 'DELETE' })
    assert.equal(deletedAttachment.response.status, 200)
    const withoutAttachment = await request(`/api/projects/${projectId}/contract`)
    assert.deepEqual(withoutAttachment.body.data.attachments, [])
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await db.pool.end()
  }
})
