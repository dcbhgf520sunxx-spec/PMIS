const assert = require('node:assert/strict')
const test = require('node:test')
const { actions, dispatchActionTool, validateActionBusinessRules } = require('../src/mcp/actionTools')
const { OSS_FILE_ORIGIN } = require('../src/services/projectContractOssService')

const context = { client: { id: 3 }, user: { id: 8, employeeNo: 'FIXTURE', realName: '隔离测试' },
  allowedMenuPaths: new Set(['/projects']), allowedPermissionCodes: new Set() }

function uploadFixture(t) {
  let body = '%PDF-1.7\nconfirmed', downloads = 0, uploaded, ticket
  t.mock.method(global, 'fetch', async () => { downloads++; return new Response(body, { headers: { 'content-type': 'application/pdf' } }) })
  const dependencies = {
    actions: { contract_attachment_upload: [async (req, res) => {
      uploaded = req.file.buffer.toString(); res.json({ code: 0, data: { id: 1 } })
    }, actions.contract_attachment_upload[1]] },
    database: { prepare: () => ({ get: async () => ({ id: 2 }), all: async () => [] }) },
    validateStatus: async () => {},
    loadTarget: async () => ({ type: 'contract', id: 2, current: { owner_id: 8 } }),
    runTransaction: async (fn) => fn(), runSavepoint: async (fn) => fn(),
    ticketService: {
      createTicket: async (_context, _name, _args, preview, _risk, executionState, fileState) => {
        ticket = { preview: { ...preview, ...(executionState ? { _executionState: executionState } : {}),
          ...(fileState ? { _fileState: fileState } : {}) } }
        return { confirmationId: 'fixture', preview }
      },
      consumeTicket: async () => ticket,
      markTicketFailed: async () => {},
    },
  }
  const call = (args) => dispatchActionTool('contract_attachment_upload', args, context, dependencies)
  return { call, dependencies, setBody: (value) => { body = value }, get downloads() { return downloads },
    get uploaded() { return uploaded }, get ticket() { return ticket } }
}
const uploadArgs = { project_id: 2, mode: 'preview', file_name: '合同.pdf',
  file_url: `${OSS_FILE_ORIGIN}/fixture.pdf`, idempotency_key: 'fixture-upload' }

test('upload confirmation rejects different valid bytes from the unchanged URL before uploading', async (t) => {
  const fixture = uploadFixture(t)
  const preview = await fixture.call(uploadArgs)
  fixture.setBody('%PDF-1.7\nreplacement')
  await assert.rejects(fixture.call(preview.executeArguments), (error) => error.code === 'MCP_DATA_CHANGED')
  assert.equal(fixture.uploaded, undefined)
})

test('upload executes the confirmed bytes with one download and no Buffer in its payload or ticket', async (t) => {
  const fixture = uploadFixture(t)
  const preview = await fixture.call(uploadArgs)
  const before = fixture.downloads
  const result = await fixture.call(preview.executeArguments)
  assert.equal(result.executed, true)
  assert.equal(fixture.downloads - before, 1)
  assert.equal(fixture.uploaded, '%PDF-1.7\nconfirmed')
  assert.doesNotMatch(JSON.stringify({ ticket: fixture.ticket, payload: preview.executeArguments }), /confirmed|Buffer/)
})

test('legacy upload tickets without a fingerprint require a fresh preview', async (t) => {
  const fixture = uploadFixture(t)
  const preview = await fixture.call(uploadArgs)
  fixture.ticket.preview = {}
  await assert.rejects(fixture.call(preview.executeArguments), /重新预览/)
  assert.equal(fixture.uploaded, undefined)
})

test('invalid upload ticket is rejected before any remote file is fetched', async (t) => {
  const fixture = uploadFixture(t)
  fixture.dependencies.ticketService.consumeTicket = async () => { throw Object.assign(new Error('wrong employee'), { code: 'MCP_CONFIRMATION_EMPLOYEE_MISMATCH' }) }
  await assert.rejects(fixture.call({ ...uploadArgs, mode: 'execute', confirmation_id: 'bad' }), /wrong employee/)
  assert.equal(fixture.downloads, 0)
})

test('invalid upload filenames retain the file_name field error contract', async (t) => {
  const fixture = uploadFixture(t)
  await assert.rejects(fixture.call({ ...uploadArgs, file_name: `${'a'.repeat(256)}.pdf` }),
    (error) => Boolean(error.fieldErrors?.file_name))
})

for (const [name, args, row, message] of [
  ['requirement_delete', { id: 1 }, { project_count: 1, task_count: 0, bug_count: 0 }, /关联项目/],
  ['task_create_subtask', { parent_id: 1 }, { id: 1, status: 2 }, /已完成的主任务/],
  ['stage_item_update', { project_id: 1, item_id: 2, requires_delivery_file: 1 }, { id: 2, status: 2, requires_delivery_file: 0, active_file_count: 0 }, /先上传文件/],
  ['business_attachment_upload', { business_type: 'task', business_id: 1 }, { id: 1, total: 10 }, /最多上传10个附件/],
]) test(`preview rejects the same business blocker as HTTP: ${name}`, async () => {
  const database = { prepare: () => ({ get: async () => row, all: async () => [] }) }
  await assert.rejects(validateActionBusinessRules(name, args, database), message)
})
