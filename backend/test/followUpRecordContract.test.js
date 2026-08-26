const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')
const backendRoot = path.join(projectRoot, 'backend')
const frontendRoot = path.join(projectRoot, 'frontend')
const read = (root, relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('跟进记录表使用三个真实外键且每条记录只能关联一个业务对象', () => {
  const schema = read(backendRoot, 'db/init/001_schema.sql')
  const migrationPath = path.join(backendRoot, 'db/migrations/20260825_02_add_follow_up_record.sql')
  assert.equal(fs.existsSync(migrationPath), true, '应提供跟进记录增量迁移')
  const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''

  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE(?: IF NOT EXISTS)? pms_follow_up_record/)
    assert.match(sql, /project_id BIGINT REFERENCES pms_project\(id\)/)
    assert.match(sql, /requirement_id BIGINT REFERENCES pms_requirement\(id\)/)
    assert.match(sql, /task_id BIGINT REFERENCES pms_task\(id\)/)
    assert.match(sql, /num_nonnulls\(project_id, requirement_id, task_id\) = 1/)
    assert.match(sql, /char_length\(content\) <= 200/)
  }
})

test('项目、需求和任务接口均提供同一套跟进记录增删改查入口', () => {
  for (const moduleName of ['project', 'requirement', 'task']) {
    const routes = read(backendRoot, `src/routes/${moduleName}.js`)
    assert.match(routes, /\/:id\/follow-ups/)
    assert.match(routes, /followUpController/)
  }
  const controller = read(backendRoot, 'src/controllers/followUpRecordController.js')
  assert.match(controller, /exports\.forTarget/)
  assert.match(controller, /req\.user\.id/)
  assert.match(controller, /failField\(res, 'content'/)
})

test('既有跟进日志迁回所属对象且三个历史接口展示跟进内容', () => {
  const migrationPath = path.join(backendRoot, 'db/migrations/20260825_03_relink_follow_up_history.sql')
  assert.equal(fs.existsSync(migrationPath), true, '应提供既有跟进日志归属修正迁移')
  const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
  assert.match(migration, /UPDATE pms_op_log AS log/)
  assert.match(migration, /FROM pms_follow_up_record AS follow_up/)
  assert.match(migration, /log\.target_id = follow_up\.id/)
  assert.match(migration, /log\.module = '跟进记录'/)
  assert.match(migration, /target_id = COALESCE\(follow_up\.project_id, follow_up\.requirement_id, follow_up\.task_id\)/)
  assert.match(migration, /field_name = 'follow_up_content'/)
  assert.match(migration, /'新增跟进'/)
  assert.match(migration, /'编辑跟进'/)
  assert.match(migration, /'删除跟进'/)

  for (const moduleName of ['project', 'requirement', 'task']) {
    const controller = read(backendRoot, `src/controllers/${moduleName}Controller.js`)
    const followUpFieldLabel = /follow_up_content\s*:\s*['"]跟进内容['"]|['"]follow_up_content['"]\s*:\s*['"]跟进内容['"]/
    assert.match(controller, followUpFieldLabel)
  }
})

test('三个列表页提供跟进快捷操作且三个详情页展示独立跟进记录分组', () => {
  for (const moduleName of ['project', 'requirement', 'task']) {
    const capitalized = moduleName[0].toUpperCase() + moduleName.slice(1)
    const listPage = read(frontendRoot, `src/modules/${moduleName}/pages/${capitalized}ListPage.tsx`)
    const detailPage = read(frontendRoot, `src/modules/${moduleName}/pages/${capitalized}DetailPage.tsx`)
    assert.match(listPage, /FollowUpRecordAction/)
    assert.match(detailPage, /FollowUpRecordSection/)
  }
})

test('三个历史接口统一转换既有跟进动作名称', () => {
  for (const moduleName of ['project', 'requirement', 'task']) {
    const controller = read(backendRoot, `src/controllers/${moduleName}Controller.js`)
    assert.match(controller, /normalizeFollowUpHistoryAction/)
  }
})
