# PMIS 部署说明

本文档用于部署项目管理系统基建模板。

## 1. 环境要求

- Node.js >= 18
- PostgreSQL 16
- Nginx
- PM2

安装 PM2：

```bash
npm install -g pm2
```

## 2. 拉取代码

```bash
cd /path/to/apps
git clone <PMIS_REPOSITORY_URL>
cd PMIS
```

## 3. 配置数据库

生产数据库使用 PostgreSQL。配置后端环境变量：

```bash
cd backend
cp .env.example .env
vi .env
```

示例：

```env
PORT=3103
DB_HOST=localhost
DB_PORT=5432
DB_USER=pms
DB_PASSWORD=你的密码
DB_NAME=pmis
JWT_SECRET=请替换为随机密钥
ALLOWED_ORIGIN=http://你的域名或IP
```

新环境可通过 Docker Compose 初始化 PostgreSQL；已有数据库在用户确认表结构后执行迁移：

```bash
cd backend
npm run db:migrate -- --check
npm run db:migrate
```

## 4. 安装依赖

后端：

```bash
cd /path/to/apps/PMIS/backend
npm ci --omit=dev
```

前端：

```bash
cd /path/to/apps/PMIS/frontend
npm ci
```

## 5. 构建 React 前端

```bash
cd /path/to/apps/PMIS/frontend
npm run build
```

构建产物位于：

```txt
frontend/dist
```

## 6. 配置 PM2

确认 `deploy/pm2.config.js` 中端口为 `3103`，并确认 `backend/.env` 指向 PostgreSQL。

启动后端：

```bash
cd /path/to/apps/PMIS
mkdir -p backend/logs
pm2 start deploy/pm2.config.js
pm2 save
```

查看状态：

```bash
pm2 status
pm2 logs PMIS-backend --lines 100
```

## 7. 配置 Nginx

复制配置：

```bash
sudo cp deploy/nginx.conf /etc/nginx/conf.d/PMIS.conf
```

编辑配置：

```bash
sudo vi /etc/nginx/conf.d/PMIS.conf
```

必须修改：

- `server_name`
- `root`

检查并重载：

```bash
sudo nginx -t
sudo nginx -s reload
```

## 8. 验证

健康检查：

```bash
curl http://localhost:3103/api/health
```

登录接口：

```bash
curl http://localhost:3103/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"vv123456"}'
```

浏览器访问：

```txt
http://你的域名或IP/
```

React 使用 history 路由，Nginx 必须保留 `try_files $uri $uri/ /index.html;`，否则刷新业务页面会返回 404。

## 9. 常用命令

```bash
pm2 status
pm2 restart PMIS-backend
pm2 logs PMIS-backend --lines 100
sudo nginx -t
sudo nginx -s reload
```

## 10. 注意事项

- 后端端口使用 `3103`
- 前端生产访问由 Nginx 提供
- 数据库为 PostgreSQL，不使用 MySQL
- 不要占用 `3001`、`3002`
- 每个项目实例必须使用独立 `DB_NAME`
- `backend/.env` 不得提交
- 默认账号为 `admin / vv123456`
