const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const projectRoot = path.resolve(__dirname, '../..')

test('初始化和增量迁移均创建知识库菜单并默认授予管理员', () => {
  const schema = fs.readFileSync(path.join(projectRoot, 'backend/db/init/001_schema.sql'), 'utf8')
  const migration = fs.readFileSync(path.join(projectRoot, 'backend/db/migrations/20260810_01_add_knowledge_base_menu.sql'), 'utf8')
  assert.match(schema, /'知识库',\s*'knowledge_base',\s*2,\s*'\/knowledge-base',\s*'BookOutlined',\s*12,/)
  assert.match(migration, /INSERT INTO pms_menu[\s\S]*?'知识库'[\s\S]*?'knowledge_base'[\s\S]*?'\/knowledge-base'[\s\S]*?'BookOutlined'[\s\S]*?12/i)
  assert.match(migration, /INSERT INTO pms_role_menu[\s\S]*?SELECT\s+1,\s*id\s+FROM pms_menu\s+WHERE code\s*=\s*'knowledge_base'/i)
})
