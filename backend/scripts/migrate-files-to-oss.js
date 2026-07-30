const fs = require('node:fs/promises')
const path = require('node:path')

const db = require('../src/db')
const {
  PRIVATE_ATTACHMENT_DIR,
  PROJECT_PLAN_DELIVERY_DIR,
  resolveAttachmentPath,
} = require('../src/services/projectContractAttachmentService')
const { uploadAttachmentToOss } = require('../src/services/projectContractOssService')
const { uploadAvatarToOss } = require('../src/services/accountService')
const { uploadRichTextImageToOss } = require('../src/services/richTextImageOssService')
const { migrateRichTextDataImages } = require('../src/services/historicalFileMigrationService')

const RICH_TEXT_FIELDS = [
  { table: 'pms_requirement', id: 'id', field: 'description' },
  { table: 'pms_task', id: 'id', field: 'description' },
  { table: 'pms_bug', id: 'id', field: 'description' },
  { table: 'pms_work_order', id: 'id', field: 'problem_desc' },
  { table: 'pms_work_order', id: 'id', field: 'result_desc' },
  { table: 'pms_op_log', id: 'id', field: 'old_value' },
  { table: 'pms_op_log', id: 'id', field: 'new_value' },
]

function resolveMode(args = []) {
  if (!args.includes('--apply')) return 'check'
  if (!args.includes('--user-approved')) {
    throw new Error('执行历史文件迁移缺少 --user-approved，请先取得用户明确确认')
  }
  return 'apply'
}

async function readLocalFile(root, storageName) {
  const filePath = resolveAttachmentPath(storageName, root)
  return fs.readFile(filePath)
}

async function migrateStoredFiles({ apply, log, failures }) {
  const groups = [
    {
      label: '合同附件',
      rows: await db.prepare(`SELECT id, original_name, storage_name storage_key, mime_type
        FROM pms_project_contract_attachment
        WHERE oss_response IS NULL ORDER BY id`).all(),
      root: PRIVATE_ATTACHMENT_DIR,
      update: (row, saved) => db.prepare(`UPDATE pms_project_contract_attachment
        SET storage_name = ?, oss_response = ? WHERE id = ? AND oss_response IS NULL`)
        .run(saved.storageName, JSON.stringify(saved.ossResponse), row.id),
    },
    {
      label: '阶段交付文件',
      rows: await db.prepare(`SELECT id, original_name, storage_key, mime_type
        FROM pms_project_plan_delivery_file
        WHERE oss_response IS NULL ORDER BY id`).all(),
      root: PROJECT_PLAN_DELIVERY_DIR,
      update: (row, saved) => db.prepare(`UPDATE pms_project_plan_delivery_file
        SET storage_key = ?, oss_response = ? WHERE id = ? AND oss_response IS NULL`)
        .run(saved.storageName, JSON.stringify(saved.ossResponse), row.id),
    },
  ]

  let migrated = 0
  for (const group of groups) {
    log(`${group.label}：发现 ${group.rows.length} 条待迁移记录`)
    for (const row of group.rows) {
      try {
        const buffer = await readLocalFile(group.root, row.storage_key)
        if (!apply) continue
        const saved = await uploadAttachmentToOss({
          originalname: row.original_name,
          mimetype: row.mime_type,
          size: buffer.length,
          buffer,
        })
        const updated = await group.update(row, saved)
        migrated += Number(updated.changes || 0)
      } catch (error) {
        failures.push(`${group.label}#${row.id}：${error.message}`)
      }
    }
  }
  return migrated
}

function avatarMime(fileName) {
  const extension = path.extname(fileName).toLowerCase()
  const mime = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }[extension]
  if (!mime) throw new Error(`不支持的历史头像格式：${extension || '无扩展名'}`)
  return mime
}

async function migrateAvatars({ apply, log, failures }) {
  const rows = await db.prepare(`SELECT id, avatar_url
    FROM pms_user WHERE avatar_url LIKE '/uploads/avatars/%' ORDER BY id`).all()
  log(`历史头像：发现 ${rows.length} 条待迁移记录`)
  let migrated = 0
  for (const row of rows) {
    try {
      const fileName = path.basename(row.avatar_url)
      const buffer = await fs.readFile(path.join(__dirname, '../uploads/avatars', fileName))
      if (!apply) continue
      const uploaded = await uploadAvatarToOss({
        fileName,
        mimeType: avatarMime(fileName),
        contentBase64: buffer.toString('base64'),
      })
      const updated = await db.prepare(`UPDATE pms_user SET avatar_url = ?, updated_at = NOW()
        WHERE id = ? AND avatar_url = ?`).run(uploaded.avatar_url, row.id, row.avatar_url)
      migrated += Number(updated.changes || 0)
    } catch (error) {
      failures.push(`历史头像#${row.id}：${error.message}`)
    }
  }
  return migrated
}

async function migrateRichText({ apply, log, failures }) {
  let migratedRows = 0
  let migratedImages = 0
  for (const spec of RICH_TEXT_FIELDS) {
    const rows = await db.prepare(`SELECT ${spec.id} row_id, ${spec.field} content
      FROM ${spec.table}
      WHERE ${spec.field} LIKE '%data:image/%'
      ORDER BY ${spec.id}`).all()
    log(`${spec.table}.${spec.field}：发现 ${rows.length} 条待迁移记录`)
    for (const row of rows) {
      try {
        if (!apply) {
          migratedImages += [...String(row.content).matchAll(/data:image\//gi)].length
          continue
        }
        const result = await migrateRichTextDataImages(row.content, {
          uploadImage: uploadRichTextImageToOss,
        })
        const updated = await db.prepare(`UPDATE ${spec.table} SET ${spec.field} = ?
          WHERE ${spec.id} = ? AND ${spec.field} = ?`)
          .run(result.value, row.row_id, row.content)
        migratedRows += Number(updated.changes || 0)
        migratedImages += result.migratedCount
      } catch (error) {
        failures.push(`${spec.table}.${spec.field}#${row.row_id}：${error.message}`)
      }
    }
  }
  return { migratedRows, migratedImages }
}

async function run({
  args = process.argv.slice(2),
  log = console.log,
} = {}) {
  const apply = resolveMode(args) === 'apply'
  const failures = []
  log(apply ? '开始执行历史文件 OSS 迁移' : '仅检查历史文件，不上传、不修改数据库')
  const storedFiles = await migrateStoredFiles({ apply, log, failures })
  const avatars = await migrateAvatars({ apply, log, failures })
  const richText = await migrateRichText({ apply, log, failures })
  log(`结果：文件 ${storedFiles} 条，头像 ${avatars} 条，富文本 ${richText.migratedRows} 条/${richText.migratedImages} 张图片`)
  if (failures.length) {
    for (const failure of failures) console.error(`迁移失败：${failure}`)
    throw new Error(`历史文件迁移存在 ${failures.length} 条失败，原记录均已保留`)
  }
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
    .finally(() => db.pool.end())
}

module.exports = {
  RICH_TEXT_FIELDS,
  resolveMode,
  run,
}
