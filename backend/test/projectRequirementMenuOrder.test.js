const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const projectRoot = path.resolve(__dirname, '../..')

test('初始化和增量迁移均将需求管理排在项目管理之前', () => {
  const schema = fs.readFileSync(path.join(projectRoot, 'backend/db/init/001_schema.sql'), 'utf8')
  const migration = fs.readFileSync(
    path.join(projectRoot, 'backend/db/migrations/20260807_01_swap_project_requirement_menu_order.sql'),
    'utf8'
  )

  assert.match(schema, /'项目管理',\s*'project',[\s\S]*?'ProjectOutlined',\s*8,/)
  assert.match(schema, /'需求管理',\s*'requirement',[\s\S]*?'FileTextOutlined',\s*7,/)
  assert.match(migration, /sort_order\s*=\s*8[\s\S]*?code\s*=\s*'project'/i)
  assert.match(migration, /sort_order\s*=\s*7[\s\S]*?code\s*=\s*'requirement'/i)
})
