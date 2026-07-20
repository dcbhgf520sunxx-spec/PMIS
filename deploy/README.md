# PMIS 部署说明

本文档用于部署项目管理系统基建模板。

## 1. 环境要求

- Node.js >= 22.18
- PostgreSQL 16
- Nginx
- systemd

CentOS 7 不能直接运行 Node.js 22 官方二进制包，也没有 PostgreSQL 16 官方仓库包。生产机采用源码安装到独立目录，不替换系统组件：

- Node.js：`/opt/node-v22.23.1`
- PostgreSQL：`/opt/postgresql-16`
- PostgreSQL 数据：`/var/lib/pgsql/16/data`
- PostgreSQL 仅监听 `127.0.0.1:5433`

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
ALLOWED_ORIGIN=https://你的域名或IP
```

环境文件包含数据库密码和 JWT 密钥，创建后必须限制为仅部署账号可读写：

```bash
chmod 600 backend/.env
```

新环境执行 `backend/db/init/001_schema.sql` 初始化 PostgreSQL 后，只登记已包含在初始化脚本中的迁移基线：

```bash
cd backend
npm run db:migrate -- --baseline
```

`--baseline` 只用于当前初始化脚本新建的空白环境。已有业务数据库仍应在用户确认表结构后按顺序检查并执行增量迁移：

```bash
cd backend
npm run db:migrate -- --check
npm run db:migrate -- --apply --user-approved
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

## 6. 配置 systemd

生产配置保存在 `/opt/pmis/shared/backend.env`，权限必须为 `600`。安装服务文件：

```bash
sudo cp deploy/postgresql-16.service /etc/systemd/system/
sudo cp deploy/pmis-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now postgresql-16 pmis-backend
```

应用使用不可变发布目录和 `current` 软链接：

```bash
sudo mkdir -p /opt/pmis/releases /opt/pmis/shared/uploads
sudo ln -sfn /opt/pmis/releases/<release> /opt/pmis/current
```

查看状态：

```bash
systemctl status pmis-backend postgresql-16
journalctl -u pmis-backend -n 100 --no-pager
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
https://你的域名或IP/
```

React 使用 history 路由，Nginx 必须保留 `try_files $uri $uri/ /index.html;`，否则刷新业务页面会返回 404。

## 9. 常用命令

```bash
systemctl status pmis-backend postgresql-16
systemctl restart pmis-backend
journalctl -u pmis-backend -n 100 --no-pager
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
- 生产数据迁移后沿用旧系统账号和密码哈希，不再使用初始化默认密码
- PostgreSQL 备份脚本为 `deploy/backup-postgresql.sh`，生产凭据通过 `.pgpass` 提供
