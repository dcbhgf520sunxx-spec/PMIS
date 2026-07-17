const express = require('express')
const cors = require('cors')
require('./config/loadEnv')
const path = require('path')
const db = require('./db')
const { validateRuntimeConfig } = require('./config/runtimeConfig')
const { attachResponseHelpers, ok, fail } = require('./utils/response')
const { requestContext } = require('./middleware/requestContext')
const { verifyToken } = require('./middleware/auth')
const { checkPermission } = require('./middleware/checkPermission')
const userRoutes = require('./routes/user')
const userController = require('./controllers/userController')
const authRoutes = require('./routes/auth')
const roleRoutes = require('./routes/role')
const roleController = require('./controllers/roleController')
const menuRoutes = require('./routes/menu')
const archiveTypeRoutes = require('./routes/archiveType')
const archiveRoutes = require('./routes/archive')
const archiveController = require('./controllers/archiveController')
const workOrderRoutes = require('./routes/workOrder')
const accessLogRoutes = require('./routes/accessLog')
const messageRoutes = require('./routes/message')
const productRoutes = require('./routes/product')
const projectRoutes = require('./routes/project')
const requirementRoutes = require('./routes/requirement')
const taskRoutes = require('./routes/task')
const bugRoutes = require('./routes/bug')

const app = express()
const { allowedOrigin } = validateRuntimeConfig()
// 生产只经过一层本机 Nginx，避免任意客户端伪造 X-Forwarded-For。
app.set('trust proxy', 1)
app.use(requestContext)
app.use(attachResponseHelpers)
app.use(cors({ origin: allowedOrigin, credentials: true }))
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// 公开接口（不需要登录）
app.use('/api/auth', authRoutes)
app.get('/api/health', async (req, res) => {
  try {
    await db.prepare('SELECT 1 as ok').get()
    ok(res, { status: 'healthy', db: 'connected' }, 'ok')
  } catch (e) {
    fail(res, 503, 503, 'unhealthy', { status: 'error', db: 'disconnected' })
  }
})

// 所有登录用户共用的下拉选项和个人消息接口，不对应独立菜单权限。
app.get('/api/user-options', verifyToken, userController.options)
app.get('/api/role-options', verifyToken, roleController.options)
app.get('/api/archive-options/by-type-name', verifyToken, archiveController.getByTypeName)
app.use('/api/messages', verifyToken, messageRoutes)

// 业务接口必须先验证登录，再检查对应功能权限。
app.use('/api/users', verifyToken, checkPermission('/users'), userRoutes)
app.use('/api/roles', verifyToken, checkPermission('/roles'), roleRoutes)
// 菜单列表用于角色授权配置，复用“角色管理”页面权限，不单独暴露菜单管理入口。
app.use('/api/menus', verifyToken, checkPermission('/roles'), menuRoutes)
app.use('/api/archive-types', verifyToken, checkPermission('/archive'), archiveTypeRoutes)
app.use('/api/archives', verifyToken, checkPermission('/archive'), archiveRoutes)
app.use('/api/work-orders', verifyToken, checkPermission('/work-orders'), workOrderRoutes)
app.use('/api/products', verifyToken, checkPermission('/products'), productRoutes)
app.use('/api/projects', verifyToken, checkPermission('/projects'), projectRoutes)
app.use('/api/requirements', verifyToken, checkPermission('/requirements'), requirementRoutes)
app.use('/api/tasks', verifyToken, checkPermission('/tasks'), taskRoutes)
app.use('/api/bugs', verifyToken, checkPermission('/bugs'), bugRoutes)
app.use('/api/access-logs', verifyToken, checkPermission('/access-logs'), accessLogRoutes)

app.use((err, req, res, _next) => {
  console.error(`[${req.requestId || 'unknown'}]`, err.stack)
  fail(res, 500, 500, '服务器内部错误')
})

module.exports = app
