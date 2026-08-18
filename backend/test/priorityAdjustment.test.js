const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('优先级统一为高、中、低且新增默认低', () => {
  const rulesPath = path.join(root, 'src/services/priorityRules.js')
  assert.equal(fs.existsSync(rulesPath), true, '缺少统一优先级规则')
  const { DEFAULT_PRIORITY, PRIORITY_VALUES, parsePriority } = require(rulesPath)
  assert.equal(DEFAULT_PRIORITY, 0)
  assert.deepEqual(PRIORITY_VALUES, [0, 1, 2])
  assert.equal(parsePriority(2), 2)
  assert.equal(parsePriority('1'), 1)
  assert.equal(parsePriority(3), null)
})

test('项目增加优先级字段且需求任务默认值调整为低', () => {
  const schema = read('db/init/001_schema.sql')
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_project[\s\S]*?priority SMALLINT NOT NULL DEFAULT 0 CHECK \(priority IN \(0,\s*1,\s*2\)\)/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_requirement[\s\S]*?priority SMALLINT NOT NULL DEFAULT 0 CHECK \(priority IN \(0,\s*1,\s*2\)\)/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_task[\s\S]*?priority SMALLINT NOT NULL DEFAULT 0 CHECK \(priority IN \(0,\s*1,\s*2\)\)/)
  assert.equal(fs.existsSync(path.join(root, 'db/migrations/20260817_01_add_priority_adjustment.sql')), true, '缺少优先级迁移')
})

test('新增强制低优先级且普通编辑不更新优先级', () => {
  for (const name of ['project', 'requirement', 'task']) {
    const source = read(`src/controllers/${name}Controller.js`)
    assert.match(source, /DEFAULT_PRIORITY/)
    assert.match(source, /exports\.updatePriority/)
    assert.match(source, /调整优先级/)
  }
  const project = read('src/controllers/projectController.js')
  const requirement = read('src/controllers/requirementController.js')
  const task = read('src/controllers/taskController.js')
  const ordinaryUpdate = (source) => source.slice(source.indexOf('exports.update'), source.indexOf('exports.updatePriority'))
  assert.doesNotMatch(ordinaryUpdate(project), /UPDATE pms_project SET[^`]*priority\s*=/)
  assert.doesNotMatch(ordinaryUpdate(requirement), /UPDATE pms_requirement SET[^`]*priority\s*=/)
  assert.doesNotMatch(ordinaryUpdate(task), /UPDATE pms_task SET[^`]*priority\s*=/)
})

test('三个优先级调整接口使用独立按钮权限', () => {
  const middleware = read('src/middleware/checkPermission.js')
  assert.match(middleware, /function checkPermissionCode\(permissionCode\)/)
  assert.match(middleware, /WHERE code = \? AND is_deleted = 0 AND status = 1/)
  for (const [moduleName, code] of [
    ['project', 'project_priority_adjust'],
    ['requirement', 'requirement_priority_adjust'],
    ['task', 'task_priority_adjust'],
  ]) {
    const route = read(`src/routes/${moduleName}.js`)
    assert.match(route, new RegExp(`checkPermissionCode\\('${code}'\\)`))
    assert.match(route, /router\.put\('\/:id\/priority'/)
  }
})

test('任务批量调整优先级复用独立按钮权限并记录每条变更', () => {
  const route = read('src/routes/task.js')
  const controller = read('src/controllers/taskController.js')
  assert.match(route, /router\.put\('\/batch-priority', checkPermissionCode\('task_priority_adjust'\), controller\.batchUpdatePriority\)/)
  assert.match(controller, /exports\.batchUpdatePriority/)
  assert.match(controller, /parsePriority\(req\.body\.priority\)/)
  assert.match(controller, /'\u6279\u91cf调整优先级'/)
  assert.match(controller, /updated, requested: ids\.length/)
})

test('按钮权限沿用菜单和角色权限表、名称与页面按钮一致且默认只授予管理员', () => {
  const schema = read('db/init/001_schema.sql')
  for (const code of [
    'requirement_priority_adjust',
    'project_priority_adjust',
    'task_priority_adjust',
  ]) {
    assert.match(schema, new RegExp(`'调整优先级', '${code}'`))
    assert.match(schema, new RegExp(code))
  }
  const renameMigration = read('db/migrations/20260818_01_align_priority_permission_names.sql')
  assert.match(renameMigration, /UPDATE pms_menu/)
  assert.match(renameMigration, /name = '调整优先级'/)
  assert.match(renameMigration, /requirement_priority_adjust/)
  assert.match(renameMigration, /project_priority_adjust/)
  assert.match(renameMigration, /task_priority_adjust/)
  assert.match(schema, /type[^\n]*3/)
  assert.match(schema, /INSERT INTO pms_role_menu[\s\S]*SELECT 1, id FROM pms_menu/)
})
