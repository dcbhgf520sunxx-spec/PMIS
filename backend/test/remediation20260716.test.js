const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..', '..')
const read = (file) => readFileSync(join(root, file), 'utf8')

test('首次登录限制由后端执行且初始化管理员需要改密', () => {
  const schema = read('backend/db/init/001_schema.sql')
  const auth = read('backend/src/middleware/auth.js')
  const routes = read('backend/src/routes/auth.js')

  assert.match(schema, /VALUES \(1, 'admin',[\s\S]*?, 1, 1\)/)
  assert.match(auth, /first_login/)
  assert.match(auth, /首次登录.*修改密码|请先修改密码/)
  assert.doesNotMatch(routes, /OR real_name = \?/)
})

test('重置密码重新要求首次改密且日志不记录明文密码', () => {
  const users = read('backend/src/controllers/userController.js')
  assert.match(users, /UPDATE pms_user SET password = \?, first_login = 1/)
  assert.doesNotMatch(users, /'password', '\*\*\*', 'vv123456'/)
  assert.match(users, /'password', '\*\*\*', '\*\*\*'/)
})

test('通用资料更新不能修改手机号', () => {
  const account = read('backend/src/services/accountService.js')
  const updateProfileBody = account.match(/async function updateProfile[\s\S]*?\n}\n\nasync function changePhone/)?.[0] || ''
  assert.doesNotMatch(updateProfileBody, /payload\.phone|SET phone/)
})

test('事务内日志使用事务连接', () => {
  const users = read('backend/src/controllers/userController.js')
  const menus = read('backend/src/controllers/menuController.js')
  const createBody = users.match(/exports\.create[\s\S]*?exports\.update/)?.[0] || ''
  const saveMenusBody = menus.match(/exports\.saveRoleMenus[\s\S]*?\n}/)?.[0] || menus
  assert.match(createBody, /await conn\.writeLog/)
  assert.doesNotMatch(createBody, /await db\.writeLog/)
  assert.match(saveMenusBody, /await conn\.writeLog/)
})

test('本地、部署和远程检查使用兼容 TypeScript 测试的 Node 版本', () => {
  const deploy = read('deploy/README.md')
  const nginx = read('deploy/nginx.conf')
  const workflow = read('.github/workflows/verify.yml')
  const frontendPackage = JSON.parse(read('frontend/package.json'))
  const backendPackage = JSON.parse(read('backend/package.json'))
  assert.match(deploy, /Node\.js\s*>=\s*22\.18/)
  assert.equal(frontendPackage.engines.node, '>=22.18.0')
  assert.equal(backendPackage.engines.node, '>=22.18.0')
  assert.match(workflow, /node-version:\s*22\.18\.0/)
  assert.match(workflow, /actions\/checkout@v5/)
  assert.match(workflow, /actions\/setup-node@v5/)
  assert.match(nginx, /client_max_body_size\s+8m;/)
})

test('软删除后角色和档案类型编码可复用且工单关联有外键', () => {
  const schema = read('backend/db/init/001_schema.sql')
  const migration = read('backend/db/migrations/20260716_01_enforce_confirmed_constraints.sql')

  for (const source of [schema, migration]) {
    assert.match(source, /ux_pms_role_code_active[\s\S]*WHERE is_deleted = 0/)
    assert.match(source, /ux_pms_archive_type_code_active[\s\S]*WHERE is_deleted = 0/)
    assert.match(source, /ux_pms_archive_type_prefix_active[\s\S]*WHERE is_deleted = 0/)
    assert.match(source, /FOREIGN KEY \(product_id\)[\s\S]*REFERENCES pms_product\(id\)/)
    assert.match(source, /FOREIGN KEY \(problem_type\)[\s\S]*REFERENCES pms_archive\(id\)/)
  }
  const roleTable = schema.match(/CREATE TABLE IF NOT EXISTS pms_role \([\s\S]*?\n\);/)?.[0] || ''
  assert.doesNotMatch(roleTable, /code VARCHAR\(50\) NOT NULL UNIQUE/)
})

test('新增档案类型生成序号时忽略业务英文编码', () => {
  const archiveTypes = read('backend/src/controllers/archiveTypeController.js')

  assert.match(
    archiveTypes,
    /SELECT MAX\(CAST\(code AS INTEGER\)\)[^\n]*WHERE is_deleted = 0 AND code ~ '\^\[0-9\]\+\$'/
  )
})

test('工单后端校验固定选项、启用跟进人和严格状态顺序', () => {
  const workOrders = read('backend/src/controllers/workOrderController.js')
  assert.match(workOrders, /validateActiveProduct\(product_id\)/)
  assert.match(workOrders, /validateActiveArchive\(problem_type, 'PT'/)
  assert.match(workOrders, /status = 1 AND [a-z]+\.is_deleted = 0|is_deleted = 0 AND [a-z]+\.status = 1/)
  assert.match(workOrders, /WORK_ORDER_STATUS_TRANSITIONS/)
  assert.match(workOrders, /0:\s*\[1\]/)
  assert.match(workOrders, /1:\s*\[2\]/)
  assert.match(workOrders, /2:\s*\[3\]/)
  assert.match(workOrders, /resolve_date[\s\S]*result_desc/)
  assert.match(workOrders, /close_date/)
  assert.match(workOrders, /WHERE id = \? AND status = \? AND is_deleted = 0/)
  assert.match(workOrders, /状态已被其他人修改/)
  assert.match(workOrders, /safeProblemDesc\.trim\(\)/)
})

test('分页总数独立查询且用户角色筛选不产生重复行', () => {
  const users = read('backend/src/controllers/userController.js')
  const roles = read('backend/src/controllers/roleController.js')
  const workOrders = read('backend/src/controllers/workOrderController.js')
  assert.match(users, /SELECT COUNT\(\*\) as total/)
  assert.match(users, /EXISTS\s*\(SELECT 1 FROM pms_user_role/i)
  assert.match(roles, /SELECT COUNT\(\*\) as total/)
  assert.match(workOrders, /buildWorkOrderCountSql[\s\S]*currentTotal/)
})

test('核心实体不存在时统一提示且业务更新维护更新时间', () => {
  for (const file of [
    'backend/src/controllers/userController.js',
    'backend/src/controllers/roleController.js',
    'backend/src/controllers/archiveTypeController.js',
    'backend/src/controllers/archiveController.js',
    'backend/src/controllers/workOrderController.js'
  ]) {
    const source = read(file)
    assert.match(source, /数据不存在或已被删除/)
    assert.match(source, /updated_at = NOW\(\)/)
  }
})

test('用户角色绑定只接受有效角色且用户维护密码复用统一规则', () => {
  const users = read('backend/src/controllers/userController.js')
  assert.match(users, /validateActiveRoleIds/)
  assert.match(users, /r\.is_deleted = 0/)
  assert.match(users, /validateNewPassword\(password\)/)
})

test('用户和角色列表批量加载关联数据避免逐行查询', () => {
  const users = read('backend/src/controllers/userController.js')
  const roles = read('backend/src/controllers/roleController.js')
  const userList = users.match(/exports\.list[\s\S]*?exports\.options/)?.[0] || ''
  const roleList = roles.match(/exports\.list[\s\S]*?exports\.getAll/)?.[0] || ''
  assert.doesNotMatch(userList, /for \(const row of rows\)[\s\S]*?await getRoles\.all/)
  assert.match(userList, /ur\.user_id IN/)
  assert.doesNotMatch(roleList, /for \(const row of rows\)[\s\S]*?prepare\('SELECT menu_id/)
  assert.match(roleList, /rm\.role_id IN/)
  assert.match(userList, /roles:\s*`\(SELECT STRING_AGG/)
})

test('前后端 lint 纳入统一门禁且 GitHub 自动执行', () => {
  const backendPackage = JSON.parse(read('backend/package.json'))
  const frontendPackage = JSON.parse(read('frontend/package.json'))
  const verify = read('scripts/verify-change.mjs')
  const workflow = read('.github/workflows/verify.yml')
  assert.equal(backendPackage.scripts.lint, 'eslint .')
  assert.match(frontendPackage.scripts.lint, /^eslint \. .*--max-warnings=0$/)
  assert.match(verify, /'run', 'lint'/)
  assert.match(workflow, /node scripts\/verify-change\.mjs/)
})

test('应用创建与端口监听分离，测试导入不会启动正式服务', () => {
  const app = read('backend/src/app.js')
  const server = read('backend/src/server.js')
  const backendPackage = JSON.parse(read('backend/package.json'))
  assert.doesNotMatch(app, /app\.listen\(/)
  assert.match(server, /app\.listen\(/)
  assert.equal(backendPackage.scripts.start, 'node src/server.js')
})

test('控制器复用同一个请求体验证入口', () => {
  assert.equal(existsSync(join(root, 'backend/src/utils/requestValidation.js')), true)
  const utility = read('backend/src/utils/requestValidation.js')
  assert.match(utility, /function requireValidBody/)
  assert.match(utility, /validateBody\(body, schema\)/)
  assert.match(utility, /fail\(res, 400, 400, result\.message\)/)

  for (const file of [
    'backend/src/controllers/archiveController.js',
    'backend/src/controllers/roleController.js',
    'backend/src/controllers/userController.js',
    'backend/src/controllers/workOrderController.js'
  ]) {
    const source = read(file)
    assert.match(source, /require\('\.\.\/utils\/requestValidation'\)/)
    assert.doesNotMatch(source, /function requireValidBody/)
  }
})

test('工单相邻记录由 PostgreSQL 计算且只向 Node 返回当前一行', () => {
  const workOrders = read('backend/src/controllers/workOrderController.js')
  const neighbors = workOrders.match(/exports\.getNeighbors[\s\S]*?\/\*\* Field name mapping/)?.[0] || ''
  assert.match(neighbors, /LAG\(w\.id\) OVER/)
  assert.match(neighbors, /LEAD\(w\.id\) OVER/)
  assert.match(neighbors, /ROW_NUMBER\(\) OVER/)
  assert.match(neighbors, /COUNT\(\*\) OVER\(\)/)
  assert.match(neighbors, /\.get\(\.\.\.whereParams, id\)/)
  assert.doesNotMatch(neighbors, /allRows|findIndex/)
})
