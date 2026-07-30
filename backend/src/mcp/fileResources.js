const db = require('../db')
const { resolveOssFile } = require('../services/projectContractOssService')
const { createOssAccessUrl } = require('../services/ossFileUrlService')

function parsePmisResourceUri(uri) {
  let match = /^pmis:\/\/projects\/(\d+)\/contract\/attachments\/(\d+)$/.exec(uri)
  if (match) return { type: 'contract', projectId: Number(match[1]), attachmentId: Number(match[2]) }
  match = /^pmis:\/\/projects\/(\d+)\/stage-plan\/items\/(\d+)\/files\/(\d+)$/.exec(uri)
  if (match) return { type: 'stage', projectId: Number(match[1]), itemId: Number(match[2]), fileId: Number(match[3]) }
  throw new Error('MCP资源地址不合法')
}

function toMcpUrlResource({ uri, mimeType, fileName, fileSize, fileUrl }) {
  return {
    uri,
    mimeType: mimeType || 'application/octet-stream',
    text: JSON.stringify({
      file_name: fileName,
      file_size: Number(fileSize),
      file_url: fileUrl,
    }),
  }
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
  if (!row.oss_response) throw new Error('合同附件尚未迁移到OSS，暂时无法返回文件URL')
  const file = resolveOssFile(row.oss_response)
  return toMcpUrlResource({
    uri,
    mimeType: row.mime_type,
    fileName: row.original_name,
    fileSize: row.file_size,
    fileUrl: createOssAccessUrl({ filePath: file.filePath, fileName: row.original_name }),
  })
}

async function readStageResource(parsed, uri) {
  const row = await db.prepare(`
    SELECT f.original_name, f.storage_key, f.oss_response, f.mime_type, f.size_bytes
    FROM pms_project_plan_delivery_file f
    JOIN pms_project_plan_item i ON i.id = f.plan_item_id AND i.is_deleted = 0
    JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
    JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
    WHERE p.id = ? AND i.id = ? AND f.id = ? AND f.is_current = 1 AND f.is_void = 0
  `).get(parsed.projectId, parsed.itemId, parsed.fileId)
  if (!row) throw new Error('交付文件不存在或归属关系不正确')
  if (!row.oss_response) throw new Error('交付文件尚未迁移到OSS，暂时无法返回文件URL')
  const file = resolveOssFile(row.oss_response)
  return toMcpUrlResource({
    uri,
    mimeType: row.mime_type,
    fileName: row.original_name,
    fileSize: row.size_bytes,
    fileUrl: createOssAccessUrl({ filePath: file.filePath, fileName: row.original_name }),
  })
}

async function listResourceTemplates(context) {
  if (!context.allowedMenuPaths.has('/projects')) return []
  return [
    {
      uriTemplate: 'pmis://projects/{projectId}/contract/attachments/{attachmentId}',
      name: '项目合同附件',
      description: '返回指定项目下合同附件的文件名、大小和OSS URL，不内联文件内容',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'pmis://projects/{projectId}/stage-plan/items/{itemId}/files/{fileId}',
      name: '阶段计划交付文件',
      description: '返回指定项目关键事项交付文件的文件名、大小和OSS URL，不内联文件内容',
      mimeType: 'application/json',
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
  toMcpUrlResource,
}
