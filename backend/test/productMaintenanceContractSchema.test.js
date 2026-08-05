const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('运维合同、附件和通用定时任务执行结构同时进入初始化与增量迁移', () => {
  const migrationPath = 'db/migrations/20260804_01_add_product_maintenance_contract.sql'
  assert.equal(fs.existsSync(path.join(root, migrationPath)), true, '缺少运维合同增量迁移')
  for (const source of [read('db/init/001_schema.sql'), read(migrationPath)]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_product_maintenance_contract/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_product_maintenance_contract_attachment/)
    assert.match(source, /CREATE TABLE IF NOT EXISTS pms_scheduled_task_execution/)
    assert.match(source, /previous_contract_id BIGINT REFERENCES pms_product_maintenance_contract\(id\) ON DELETE RESTRICT/)
    assert.match(source, /contract_amount NUMERIC\(18,2\) NOT NULL CHECK \(contract_amount > 0\)/)
    assert.match(source, /UNIQUE \(task_code, target_type, target_id, execution_key\)/)
  }
})

test('产品删除保护运维合同引用且接口复用产品管理权限', () => {
  assert.match(read('src/controllers/productController.js'), /pms_product_maintenance_contract[\s\S]*运维合同/)
  assert.match(read('src/app.js'), /app\.use\('\/api\/products',[\s\S]*checkPermission\('\/products'\)/)
  const routes = read('src/routes/product.js')
  assert.match(routes, /:\id\/maintenance-contracts/)
  assert.doesNotMatch(routes, /maintenanceContractPermission/)
})

test('运维合同新增以 multipart 同步接收必填附件', () => {
  const routes = read('src/routes/product.js')
  const controller = read('src/controllers/productMaintenanceContractController.js')
  assert.match(routes, /upload\.array\('files', 10\)/)
  assert.match(routes, /router\.post\('\/:id\/maintenance-contracts', uploadContractAttachments, contractCtrl\.create\)/)
  assert.match(controller, /validateContractAttachmentCount\(req\.files\?\.length \|\| 0\)/)
  assert.match(controller, /pms_product_maintenance_contract_attachment/)
})

test('供应商档案存在运维合同时禁止删除', () => {
  const source = read('src/controllers/archiveController.js')
  assert.match(source, /pms_product_maintenance_contract[\s\S]*运维合同引用/)
})
