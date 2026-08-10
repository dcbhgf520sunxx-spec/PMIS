const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('阶段主计划五张表同步进入初始化与迁移', () => {
  const schema = read('db/init/001_schema.sql')
  const migrationPath = path.join(root, 'db/migrations/20260723_01_add_project_stage_plan.sql')
  assert.ok(fs.existsSync(migrationPath), '缺少阶段主计划增量迁移')
  const migration = fs.readFileSync(migrationPath, 'utf8')

  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_stage/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_item/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_item_collaborator/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_adjustment/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_delivery_file/)
    assert.match(source, /uk_project_plan_stage_name_active/)
    assert.match(source, /uk_project_plan_item_name_active/)
  }
})

test('阶段主计划接口复用项目权限并包含完整操作入口', () => {
  const routes = read('src/routes/project.js')
  const app = read('src/app.js')
  assert.match(app, /app\.use\('\/api\/projects',[\s\S]*checkPermission\('\/projects'\)/)
  assert.match(routes, /stage-plan/)
  assert.match(routes, /items\/:itemId\/status/)
  assert.match(routes, /items\/:itemId\/adjustments/)
  assert.match(routes, /items\/:itemId\/files/)
})

test('任务与关键事项关联已从结构和业务代码移除', () => {
  const schema = read('db/init/001_schema.sql')
  const migrationPath = path.join(root, 'db/migrations/20260724_04_remove_task_plan_item_link.sql')
  assert.ok(fs.existsSync(migrationPath), '缺少移除任务关键事项关联的增量迁移')
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const controller = read('src/controllers/taskController.js')
  const planController = read('src/controllers/projectStagePlanController.js')
  assert.doesNotMatch(schema, /plan_item_id BIGINT REFERENCES pms_project_plan_item\(id\) ON DELETE RESTRICT/)
  assert.doesNotMatch(schema, /idx_task_plan_item_active/)
  assert.match(migration, /DROP INDEX IF EXISTS idx_task_plan_item_active/)
  assert.match(migration, /ALTER TABLE pms_task DROP COLUMN IF EXISTS plan_item_id/)
  assert.doesNotMatch(controller, /plan_item_id|plan_item_name|plan_stage_name|plan_project_id/)
  assert.doesNotMatch(planController, /task_count|pms_task WHERE plan_item_id|已关联主任务/)
})

test('关键事项批量新增固定在同一阶段并使用事务写入', () => {
  const controller = read('src/controllers/projectStagePlanController.js')
  const routes = read('src/routes/project.js')
  assert.match(routes, /post\('\/:projectId\/stage-plan\/items\/batch',\s*planCtrl\.createItems\)/)
  assert.match(controller, /exports\.createItems\s*=/)
  assert.match(controller, /req\.body\.stage_id/)
  assert.match(controller, /Array\.isArray\(req\.body\.items\)/)
  assert.match(controller, /db\.transaction/)
  assert.match(controller, /INSERT INTO pms_project_plan_item_collaborator[\s\S]*RETURNING plan_item_id AS id/)
  assert.match(controller, /Number\([^)]*requires_delivery_file\) === 1 \? '关键交付文件' : null/)
  assert.match(controller, /validatePlanAdjustmentReason\(reason\)/)
  assert.match(controller, /req\.body\.reason/)
  assert.doesNotMatch(controller, /'计划时间调整'/)
  assert.doesNotMatch(controller, /请填写关键交付文件要求/)
})

test('关键事项移除取消状态并新增暂停原因字段', () => {
  const schema = read('db/init/001_schema.sql')
  const migrationPath = path.join(root, 'db/migrations/20260724_05_simplify_project_plan_status.sql')
  assert.ok(fs.existsSync(migrationPath), '缺少关键事项状态简化增量迁移')
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const controller = read('src/controllers/projectStagePlanController.js')

  assert.match(schema, /pause_reason VARCHAR\(200\)/)
  assert.match(schema, /status IN \(0,1,2,3\)/)
  assert.doesNotMatch(schema, /status IN \(0,1,2,3,4\)/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS pause_reason VARCHAR\(200\)/)
  assert.match(migration, /UPDATE pms_project_plan_item[\s\S]*SET[\s\S]*is_deleted = 1[\s\S]*WHERE status = 4/)
  assert.match(migration, /DROP CONSTRAINT IF EXISTS ck_project_plan_item_status/)
  assert.match(controller, /pause_reason/)
  assert.match(controller, /validatePlanAdjustmentReason\(reason\)/)
})

test('交付文件不做版本管理并只开放上传下载删除', () => {
  const controller = read('src/controllers/projectStagePlanController.js')
  const routes = read('src/routes/project.js')

  assert.match(routes, /delete\('\/:projectId\/stage-plan\/items\/:itemId\/files\/:fileId',\s*planCtrl\.deleteFile\)/)
  assert.doesNotMatch(routes, /files\/:fileId\/replace|files\/:fileId\/void/)
  assert.match(controller, /exports\.deleteFile\s*=/)
  assert.match(controller, /已完成且要求交付文件的事项必须至少保留一个有效文件/)
  assert.match(controller, /if \(!file\.oss_response\)/)
  assert.match(controller, /removeAttachmentFile\(file\.storage_key,\s*DELIVERY_ROOT\)/)
  assert.doesNotMatch(controller, /exports\.replaceFile|exports\.voidFile|MAX\(version_no\)|replaces_file_id/)
})

test('关键事项由已完成退回进行中时在同一事务内失效上一轮文件', () => {
  const controller = read('src/controllers/projectStagePlanController.js')

  assert.match(controller, /shouldInvalidatePlanItemFiles\(item\.status,\s*target\)/)
  assert.match(controller, /UPDATE pms_project_plan_delivery_file SET is_current=0 WHERE plan_item_id=\? AND is_current=1 AND is_void=0/)
  assert.match(controller, /db\.transaction\(async \(tx\) => \{[\s\S]*is_current=0[\s\S]*UPDATE pms_project_plan_item SET status=/)
})

test('交付文件新上传统一进入OSS且历史本地文件保留迁移兼容', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260730_01_use_oss_for_all_files.sql')
  const controller = read('src/controllers/projectStagePlanController.js')
  const resources = read('src/mcp/fileResources.js')

  assert.match(schema, /pms_project_plan_delivery_file[\s\S]*oss_response JSONB/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS oss_response JSONB/)
  assert.match(controller, /uploadAttachmentToOss/)
  assert.match(controller, /JSON\.stringify\(saved\.ossResponse\)/)
  assert.match(controller, /loadOssAttachment/)
  assert.match(controller, /PROJECT_PLAN_DELIVERY_DIR/)
  assert.match(resources, /oss_response/)
  assert.match(resources, /createOssAccessUrl/)
  assert.doesNotMatch(controller, /private-uploads\/project-plan-deliveries/)
  assert.doesNotMatch(resources, /private-uploads\/project-plan-deliveries/)
})

test('阶段主计划模板结构、内置模板与套用接口完整落地', () => {
  const schema = read('db/init/001_schema.sql')
  const migrationPath = path.join(root, 'db/migrations/20260730_02_add_project_plan_templates.sql')
  assert.ok(fs.existsSync(migrationPath), '缺少阶段主计划模板增量迁移')
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const routes = read('src/routes/project.js')
  const controller = read('src/controllers/projectStagePlanController.js')

  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_template\b/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_template_stage\b/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_plan_template_item\b/)
    assert.match(source, /uk_project_plan_template_code/)
    assert.match(source, /AI 项目标准模板/)
  }
  assert.match(routes, /get\('\/:projectId\/stage-plan\/templates',\s*planCtrl\.listTemplates\)/)
  assert.match(routes, /post\('\/:projectId\/stage-plan\/templates\/:templateId\/apply',\s*planCtrl\.applyTemplate\)/)
  assert.match(controller, /exports\.listTemplates\s*=/)
  assert.match(controller, /exports\.applyTemplate\s*=/)
  assert.match(controller, /FOR UPDATE/)
  assert.match(controller, /阶段主计划已有内容，不能套用模板/)
  assert.match(controller, /db\.transaction/)
  assert.match(controller, /firstStageId/)
  assert.match(controller, /'套用阶段模板'[\s\S]*firstStageId/)
  assert.match(controller, /stageActions = \[[^\]]*'套用阶段模板'/)
})

test('阶段汇总时间由关键事项实时计算', () => {
  const controller = read('src/controllers/projectStagePlanController.js')
  assert.match(controller, /MAX\(i\.current_due_date\) max_due_date/)
  assert.match(controller, /COUNT\(i\.id\)>0[\s\S]*COUNT\(i\.id\) FILTER\(WHERE i\.status=2\)=COUNT\(i\.id\)[\s\S]*MAX\(i\.actual_end_date\)[\s\S]*actual_end_date/)
})
