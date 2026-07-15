const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('BUG 表使用项目需求二选一和基础档案外键', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260713_add_bug.sql')
  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_bug/)
    assert.match(source, /bug_type_id BIGINT NOT NULL REFERENCES pms_archive\(id\)/)
    assert.match(source, /resolution_id BIGINT REFERENCES pms_archive\(id\)/)
    assert.match(source, /source_type=1[\s\S]*project_id IS NOT NULL[\s\S]*requirement_id IS NULL/)
    assert.match(source, /source_type=2[\s\S]*requirement_id IS NOT NULL[\s\S]*project_id IS NULL/)
    assert.match(source, /uk_bug_title_active/)
  }
})

test('BUG 类型和解决方案使用基础档案种子', () => {
  const migration = read('db/migrations/20260713_add_bug.sql')
  assert.match(migration, /bug_type[\s\S]*Bug类型/)
  assert.match(migration, /bug_resolution[\s\S]*Bug解决方案/)
  for (const name of ['功能', '界面', '性能', '兼容', '安全', '其他', '已修复', '设计如此', '无法重现', '延期处理', '外部原因', '重复']) {
    assert.match(migration, new RegExp(name))
  }
})

test('项目需求和档案删除保护 BUG 引用', () => {
  assert.match(read('src/controllers/projectController.js'), /pms_bug[\s\S]*个 BUG/)
  assert.match(read('src/controllers/requirementController.js'), /pms_bug[\s\S]*个 BUG/)
  const archive = read('src/controllers/archiveController.js')
  assert.match(archive, /pms_bug/)
  assert.match(archive, /bug_type_id/)
  assert.match(archive, /resolution_id/)
})

test('BUG 激活原因由增量迁移加入并保留历史默认值', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260714_add_bug_activation_reason.sql')
  assert.match(schema, /activation_reason TEXT/)
  assert.match(migration, /activation_reason TEXT/)
  assert.match(migration, /问题再次复现，重新激活处理/)
})

test('BUG 激活原因统一限制为 100 字且迁移不静默截断历史数据', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260714_shorten_bug_activation_reason.sql')
  assert.match(schema, /char_length\(activation_reason\)\s*<=\s*100/)
  assert.match(migration, /char_length\(activation_reason\)\s*>\s*100/)
  assert.match(migration, /char_length\(activation_reason\)\s*<=\s*100/)
  assert.doesNotMatch(migration, /substring|left\s*\(/i)
})

test('BUG 修复或关闭后允许保留最近一次激活原因', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260714_preserve_bug_activation_reason.sql')
  for (const source of [schema, migration]) {
    assert.match(source, /status\s*<>\s*3\s+OR\s+activation_reason IS NOT NULL/)
    assert.match(source, /activation_reason IS NULL[\s\S]*char_length\(activation_reason\)\s*<=\s*100/)
    assert.doesNotMatch(source, /OR\s*\(status\s*<>\s*3\s+AND\s+activation_reason IS NULL\)/)
  }
  assert.doesNotMatch(migration, /UPDATE\s+pms_bug/i)
})

test('BUG 被激活时允许保留修复时间和解决方案', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260714_preserve_bug_resolution_fields.sql')
  for (const source of [schema, migration]) {
    assert.match(source, /status IN \(1,2,3\) OR resolution_id IS NULL/)
    assert.match(source, /status IN \(1,2,3\) OR resolved_date IS NULL/)
  }
  assert.match(migration, /DROP CONSTRAINT IF EXISTS pms_bug_check1/)
  assert.match(migration, /DROP CONSTRAINT IF EXISTS pms_bug_check2/)
  assert.doesNotMatch(migration, /UPDATE\s+pms_bug/i)
})
