const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('项目与需求关系反转为允许历史空值的一对一结构', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260807_02_project_requirement_one_to_one.sql')
  const projectTable = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS pms_project ('), schema.indexOf('CREATE TABLE IF NOT EXISTS pms_project_member'))
  const requirementTable = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS pms_requirement ('), schema.indexOf('CREATE TABLE IF NOT EXISTS pms_archive_type'))

  assert.match(projectTable, /requirement_id BIGINT/)
  assert.doesNotMatch(projectTable, /requirement_id BIGINT NOT NULL/)
  assert.doesNotMatch(requirementTable, /project_id/)
  assert.match(schema, /FOREIGN KEY \(requirement_id\) REFERENCES pms_requirement\(id\) ON DELETE RESTRICT/)
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS ux_project_requirement_active[\s\S]*?ON pms_project\(requirement_id\)[\s\S]*?WHERE is_deleted = 0 AND requirement_id IS NOT NULL/)

  assert.match(migration, /ADD COLUMN(?: IF NOT EXISTS)? requirement_id BIGINT/)
  assert.match(migration, /DROP COLUMN(?: IF EXISTS)? project_id/)
  assert.match(migration, /FOREIGN KEY \(requirement_id\) REFERENCES pms_requirement\(id\) ON DELETE RESTRICT/)
  assert.match(migration, /CREATE UNIQUE INDEX(?: IF NOT EXISTS)? ux_project_requirement_active[\s\S]*?WHERE is_deleted = 0 AND requirement_id IS NOT NULL/)
  assert.doesNotMatch(migration, /UPDATE pms_project[\s\S]*?SET requirement_id\s*=/)
})

test('项目接口强制所属需求并校验同产品和一对一占用关系', () => {
  const controller = read('src/controllers/projectController.js')
  const routes = read('src/routes/project.js')

  assert.match(controller, /requirement_id:\s*\{ required: true, type: 'number', label: '所属需求' \}/)
  assert.match(controller, /p\.requirement_id/)
  assert.match(controller, /requirement\.title requirement_name/)
  assert.match(controller, /q\.requirement_id/)
  assert.match(controller, /r\.product_id = \?[\s\S]*?p\.requirement_id = r\.id[\s\S]*?p\.id <> \?/)
  assert.match(controller, /INSERT INTO pms_project[\s\S]*?requirement_id/)
  assert.match(controller, /UPDATE pms_project SET[\s\S]*?requirement_id = \?/)
  assert.match(controller, /exports\.requirementOptions/)
  assert.match(routes, /router\.get\('\/requirement-options', ctrl\.requirementOptions\)/)
})

test('需求接口彻底移除所属项目并阻止删除已关联项目的需求', () => {
  const controller = read('src/controllers/requirementController.js')

  assert.doesNotMatch(controller, /project_id|project_name|projectName/)
  assert.match(controller, /FROM pms_project WHERE requirement_id=\? AND is_deleted=0/)
  assert.match(controller, /该需求已关联项目，无法删除/)
})

test('MCP 同步反转项目和需求的关联字段', () => {
  const catalog = read('src/mcp/catalog.js')
  const actions = read('src/mcp/actionTools.js')

  assert.match(catalog, /project_search: fields\(\[[^\]]*'requirement_id'/)
  assert.match(catalog, /project_search:\s*\{[\s\S]*?requirement_id:\s*outputField\('所属需求标识'\)/)
  assert.match(catalog, /project_create: \[[^\]]*'requirement_id'/)
  assert.doesNotMatch(catalog, /requirement: \[[^\]]*'project_id'/)
  assert.doesNotMatch(catalog, /requirement_search: fields\(\[[^\]]*'project_id'/)
  const projectTarget = actions.slice(actions.indexOf('  project: {'), actions.indexOf('  requirement: {'))
  const requirementTarget = actions.slice(actions.indexOf('  requirement: {'), actions.indexOf('  task: {'))
  assert.match(projectTarget, /currentFields: \[[^\]]*'requirement_id'/)
  assert.doesNotMatch(requirementTarget, /currentFields: \[[^\]]*'project_id'/)
})
