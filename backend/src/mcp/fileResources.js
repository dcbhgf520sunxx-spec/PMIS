const fs = require('node:fs/promises')
const db = require('../db')
const { PROJECT_PLAN_DELIVERY_DIR, resolveAttachmentPath } = require('../services/projectContractAttachmentService')
const { loadOssAttachment } = require('../services/projectContractOssService')

const INLINE_LIMIT = Number(process.env.MCP_FILE_INLINE_LIMIT || 5 * 1024 * 1024)
const DELIVERY_ROOT = PROJECT_PLAN_DELIVERY_DIR

function parsePmisResourceUri(uri) {
  let match = /^pmis:\/\/projects\/(\d+)\/contract\/attachments\/(\d+)$/.exec(uri)
  if (match) return { type: 'contract', projectId: Number(match[1]), attachmentId: Number(match[2]) }
  match = /^pmis:\/\/projects\/(\d+)\/stage-plan\/items\/(\d+)\/files\/(\d+)$/.exec(uri)
  if (match) return { type: 'stage', projectId: Number(match[1]), itemId: Number(match[2]), fileId: Number(match[3]) }
  throw new Error('MCP资源地址不合法')
}

function toMcpBlobResource({ uri, mimeType, buffer }, limit = INLINE_LIMIT) {
  if (!Buffer.isBuffer(buffer)) throw new Error('文件内容无效')
  if (buffer.length > limit) throw new Error(`文件过大，无法通过MCP内联读取（上限${limit}字节）`)
  return { uri, mimeType: mimeType || 'application/octet-stream', blob: buffer.toString('base64') }
}

async function readContractResource(parsed, uri) {
  const row = await db.prepare(`
    SELECT a.original_name, a.storage_name, a.oss_response, a.mime_type, a.file_size
    FROM pms_project_contract_attachment a
    JOIN pms_project_contract c ON c.id = a.contract_id AND c.is_deleted = 0
    JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
    WHERE p.id = ? AND a.id = ? AND a.is_deleted = 0
  `).get(parsed.projectId, parsed.attachmentId)
  if (!row) throw new Error('合同附件不存在或不属于该项目')
  if (Number(row.file_size) > INLINE_LIMIT) throw new Error('文件过大，无法通过MCP内联读取')
  let buffer
  if (row.oss_response) {
    const response = await loadOssAttachment(row.oss_response)
    buffer = Buffer.from(await response.arrayBuffer())
  } else {
    buffer = await fs.readFile(resolveAttachmentPath(row.storage_name))
  }
  return toMcpBlobResource({ uri, mimeType: row.mime_type, buffer })
}

async function readStageResource(parsed, uri) {
  const row = await db.prepare(`
    SELECT f.original_name, f.storage_key, f.mime_type, f.size_bytes
    FROM pms_project_plan_delivery_file f
    JOIN pms_project_plan_item i ON i.id = f.plan_item_id AND i.is_deleted = 0
    JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
    JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
    WHERE p.id = ? AND i.id = ? AND f.id = ? AND f.is_current = 1 AND f.is_void = 0
  `).get(parsed.projectId, parsed.itemId, parsed.fileId)
  if (!row) throw new Error('交付文件不存在或归属关系不正确')
  if (Number(row.size_bytes) > INLINE_LIMIT) throw new Error('文件过大，无法通过MCP内联读取')
  const buffer = await fs.readFile(resolveAttachmentPath(row.storage_key, DELIVERY_ROOT))
  return toMcpBlobResource({ uri, mimeType: row.mime_type, buffer })
}

async function listResourceTemplates(context) {
  if (!context.allowedMenuPaths.has('/projects')) return []
  return [
    {
      uriTemplate: 'pmis://projects/{projectId}/contract/attachments/{attachmentId}',
      name: '项目合同附件',
      description: '读取指定项目下的合同附件',
      mimeType: 'application/octet-stream',
    },
    {
      uriTemplate: 'pmis://projects/{projectId}/stage-plan/items/{itemId}/files/{fileId}',
      name: '阶段计划交付文件',
      description: '读取指定项目关键事项的交付文件',
      mimeType: 'application/octet-stream',
    },
  ]
}

async function readResource(uri, context) {
  if (!context.allowedMenuPaths.has('/projects')) throw new Error('没有项目管理权限')
  const parsed = parsePmisResourceUri(uri)
  return parsed.type === 'contract'
    ? readContractResource(parsed, uri)
    : readStageResource(parsed, uri)
}

module.exports = {
  listResourceTemplates,
  parsePmisResourceUri,
  readResource,
  toMcpBlobResource,
}
