const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')
const db = require('./db')
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
const { start: startOverdueCron } = require('./services/overdueCron')

dotenv.config()

const app = express()
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3102', credentials: true }))
app.use(express.json({ limit: '4mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// 公开接口（不需要登录）
app.use('/api/auth', authRoutes)
app.get('/api/health', async (req, res) => {
  try {
    await db.prepare('SELECT 1 as ok').get()
    res.json({ code: 0, message: 'ok', data: { status: 'healthy', db: 'connected' } })
  } catch (e) {
    res.status(503).json({ code: 503, message: 'unhealthy', data: { status: 'error', db: 'disconnected' } })
  }
})

// 需要登录的接口
app.get('/api/user-options', verifyToken, userController.options)
app.get('/api/role-options', verifyToken, roleController.options)
app.get('/api/archive-options/by-type-name', verifyToken, archiveController.getByTypeName)
app.use('/api/messages', verifyToken, messageRoutes)
app.use('/api/users', verifyToken, checkPermission('/users'), userRoutes)
app.use('/api/roles', verifyToken, checkPermission('/roles'), roleRoutes)
app.use('/api/menus', verifyToken, checkPermission('/roles'), menuRoutes)
app.use('/api/archive-types', verifyToken, checkPermission('/archive'), archiveTypeRoutes)
app.use('/api/archives', verifyToken, checkPermission('/archive'), archiveRoutes)
app.use('/api/work-orders', verifyToken, checkPermission('/work-orders'), workOrderRoutes)
app.use('/api/access-logs', verifyToken, checkPermission('/access-logs'), accessLogRoutes)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
})

const PORT = process.env.PORT || 3101
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  if (process.send) process.send('ready')
  startOverdueCron()
})

module.exports = app
