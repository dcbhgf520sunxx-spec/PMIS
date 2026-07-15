const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('用户和工单后端契约要求手机号与所属产品必填', () => {
  const users = read('backend/src/controllers/userController.js')
  const workOrders = read('backend/src/controllers/workOrderController.js')

  assert.match(users, /phone:\s*\{\s*required:\s*true/)
  assert.match(workOrders, /product_id:\s*\{\s*required:\s*true/)
})

test('初始化结构和新增迁移保持必填字段与菜单顺序一致', () => {
  const schema = read('backend/db/init/001_schema.sql')
  const migration = read('backend/db/migrations/20260711_enforce_required_fields_and_menu_order.sql')
  const productMigration = read('backend/db/migrations/20260713_work_order_product.sql')

  assert.match(schema, /phone VARCHAR\(20\) NOT NULL UNIQUE/)
  assert.match(schema, /product_id BIGINT NOT NULL/)
  assert.match(migration, /ALTER COLUMN phone SET NOT NULL/)
  assert.match(productMigration, /ALTER COLUMN product_id SET NOT NULL/)
  assert.match(migration, /code = 'base_settings'[\s\S]*sort_order = 20|sort_order = 20[\s\S]*code = 'base_settings'/)
})

test('Nginx 上传路径使用强前缀，避免图片正则覆盖', () => {
  assert.match(read('deploy/nginx.conf'), /location \^~ \/uploads\//)
})

test('审查项配置和数据库优化已落地', () => {
  const app = read('backend/src/app.js')
  const users = read('backend/src/controllers/userController.js')
  const migration = read('backend/db/migrations/20260711_optimize_review_findings.sql')
  assert.match(app, /app\.set\('trust proxy', 1\)/)
  assert.match(users, /error\?\.code === '23505'/)
  assert.doesNotMatch(users, /172\.16\.0\.45/)
  assert.match(migration, /idx_op_log_module_created_at/)
  assert.match(migration, /appearance_mode SET DEFAULT 'light'/)
  assert.match(migration, /char_length\(description\) <= 1000/)
})
