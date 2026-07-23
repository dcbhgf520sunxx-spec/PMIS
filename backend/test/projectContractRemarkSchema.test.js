const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('项目合同备注使用可空文本字段并由新增编辑接口持久化', () => {
  const migrationPath = path.join(root, 'db/migrations/20260723_02_add_project_contract_remark.sql')
  assert.equal(fs.existsSync(migrationPath), true, '应提供合同备注增量迁移')

  const schema = read('db/init/001_schema.sql')
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const controller = read('src/controllers/projectContractController.js')

  assert.match(schema, /CREATE TABLE IF NOT EXISTS pms_project_contract[\s\S]*\bremark TEXT/)
  assert.match(migration, /ALTER TABLE pms_project_contract[\s\S]*ADD COLUMN IF NOT EXISTS remark TEXT/)
  assert.match(controller, /INSERT INTO pms_project_contract[\s\S]*\bremark\b/)
  assert.match(controller, /req\.body\.remark\s*\|\|\s*null/)
  assert.match(controller, /UPDATE pms_project_contract SET[\s\S]*\bremark\s*=\s*\?/)
})
