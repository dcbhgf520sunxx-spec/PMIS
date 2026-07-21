const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('项目合同、付款阶段和付款记录同步进入初始化与增量结构', () => {
  const schema = read('db/init/001_schema.sql')
  const migration = read('db/migrations/20260720_01_add_project_contract_payment.sql')
  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_contract/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_payment_stage/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_payment_record/)
    assert.match(source, /contract_amount NUMERIC\(18,2\)/)
    assert.match(source, /payment_month DATE NOT NULL/)
    assert.match(source, /uk_project_contract_project_active/)
    assert.match(source, /uk_project_contract_code_active/)
  }
})

test('项目删除保护合同引用且合同接口继续复用项目菜单权限', () => {
  assert.match(read('src/controllers/projectController.js'), /pms_project_contract[\s\S]*合同/)
  assert.match(read('src/app.js'), /app\.use\('\/api\/projects',[\s\S]*checkPermission\('\/projects'\)/)
  const routes = read('src/routes/project.js')
  assert.match(routes, /:\id\/contract/)
  assert.doesNotMatch(routes, /contractPermission|paymentPermission/)
})

test('项目合同供应商关联供应商基础档案并迁移历史名称', () => {
  const schema = read('db/init/001_schema.sql')
  const migrationPath = path.join(root, 'db/migrations/20260721_01_link_contract_supplier_archive.sql')
  assert.ok(fs.existsSync(migrationPath), '缺少项目合同供应商基础档案迁移')
  const migration = fs.readFileSync(migrationPath, 'utf8')

  assert.match(schema, /supplier_id BIGINT NOT NULL/)
  assert.doesNotMatch(schema, /supplier_name VARCHAR\(200\) NOT NULL/)
  assert.match(schema, /\(6, 'supplier', 'SUP', '供应商'/)
  assert.match(schema, /idx_project_contract_supplier_active/)
  assert.match(schema, /fk_project_contract_supplier/)

  assert.match(migration, /INSERT INTO pms_archive_type/)
  assert.match(migration, /supplier_name/)
  assert.match(migration, /supplier_id/)
  assert.match(migration, /DROP COLUMN supplier_name/)
  assert.match(migration, /fk_project_contract_supplier/)

  const contractController = read('src/controllers/projectContractController.js')
  assert.match(contractController, /JOIN pms_archive supplier ON supplier\.id = c\.supplier_id/)
  assert.match(contractController, /supplier_id/)
  assert.match(read('src/controllers/archiveController.js'), /pms_project_contract[\s\S]*项目合同/)
})

test('项目合同附件结构同步进入初始化和增量迁移', () => {
  const schema = read('db/init/001_schema.sql')
  const migrationPath = path.join(root, 'db/migrations/20260721_02_add_project_contract_attachment.sql')
  assert.ok(fs.existsSync(migrationPath), '缺少项目合同附件迁移')
  const migration = fs.readFileSync(migrationPath, 'utf8')

  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_project_contract_attachment/)
    assert.match(source, /contract_id BIGINT NOT NULL REFERENCES pms_project_contract\(id\) ON DELETE RESTRICT/)
    assert.match(source, /original_name VARCHAR\(255\) NOT NULL/)
    assert.match(source, /storage_name VARCHAR\(255\) NOT NULL/)
    assert.match(source, /mime_type VARCHAR\(150\) NOT NULL/)
    assert.match(source, /file_size BIGINT NOT NULL CHECK \(file_size > 0 AND file_size <= 20971520\)/)
    assert.match(source, /uk_project_contract_attachment_storage_name/)
    assert.match(source, /idx_project_contract_attachment_contract_active/)
  }
})
