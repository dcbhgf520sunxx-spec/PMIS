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

Node.js 22.23.1 在 CentOS 7 上使用 GCC 11 编译前，需要按顺序应用兼容补丁：

```bash
cd /path/to/node-v22.23.1
patch -p1 < /path/to/PMIS/deploy/patches/node-v22-centos7-cares-sys-random.patch
patch -p1 < /path/to/PMIS/deploy/patches/node-v22-centos7-gcc11-wasm-union.patch
```

两个补丁分别处理旧内核缺少 `sys/random.h` / `getrandom`，以及 GCC 11 编译 V8 WebAssembly 匿名联合体时的兼容问题。

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
PUBLIC_APP_ORIGIN=https://你的域名或IP
FILE_URL_SIGNING_SECRET=独立的32字节以上随机密钥
CONTRACT_ATTACHMENT_OSS_UPLOAD_URL=http://OSS上传服务/oss/file/upload
CONTRACT_ATTACHMENT_OSS_FILE_ORIGIN=http://OSS文件服务

# 企业微信工作台单点登录
WECOM_CORP_ID=企业ID
WECOM_AGENT_ID=自建应用AgentId
WECOM_SECRET=自建应用Secret
WECOM_USER_ID_URL=http://内部服务/shr/person/getWxUserId
WECOM_CALLBACK_URL=https://你的域名或IP/api/auth/wecom/callback
WECOM_FRONTEND_URL=https://你的域名或IP
```

环境文件包含数据库密码和 JWT 密钥，创建后必须限制为仅部署账号可读写：

```bash
chmod 600 backend/.env
```

### 企业微信工作台配置

在企业微信管理后台创建或选择一个自建应用，并完成以下配置：

- 应用主页填写 `https://你的域名或IP/api/auth/wecom/start`。
- 网页授权可信域名必须与 `WECOM_CALLBACK_URL` 的域名和端口完全一致；地址带端口时，可信域名也必须登记同一端口。
- 应用可见范围包含所有需要使用 PMIS 的成员。
- 调用企业微信接口的生产服务器出口 IP 加入应用可信 IP。
- 正式服务器必须能够访问 `WECOM_USER_ID_URL`；该内部接口接收企微 `UserId`，成功时返回 `{ "code": 100, "msg": "success", "data": "账号" }`。
- 内部接口返回的 `data` 必须与 PMIS 用户的 `employee_no` 完全一致；不存在或停用的 PMIS 账号会拒绝登录。

`WECOM_SECRET` 只能保存在 `/opt/pmis/shared/backend.env`，不要写入 Nginx、前端环境变量、部署包或 Git。修改企微配置后重启后端：

```bash
sudo systemctl restart pmis-backend
```

工作台单点使用企业微信静默授权；现有工号/手机号密码登录继续保留。企微登录不会修改数据库中的 `first_login`，但本次企微会话可直接进入业务页面；以后使用密码登录时仍执行首次改密规则。

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

本次文件统一迁移在结构迁移完成后执行。先只读检查，再执行迁移：

```bash
cd backend
npm run files:migrate-oss
npm run files:migrate-oss -- --apply --user-approved
```

该脚本迁移历史合同附件、阶段交付文件、头像，以及需求、任务、BUG、工单和操作历史中的富文本内嵌图片。每条记录只有在 OSS 上传成功后才更新数据库；失败时保留原记录。首次上线验证完成前不要删除 `/opt/pmis/shared/uploads` 和 `/opt/pmis/shared/private-uploads` 中的历史文件。

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
sudo mkdir -p \
  /opt/pmis/releases \
  /opt/pmis/shared/uploads \
  /opt/pmis/shared/private-uploads/project-contracts \
  /opt/pmis/shared/private-uploads/project-plan-deliveries
sudo chown -R pmis:pmis /opt/pmis/shared/uploads /opt/pmis/shared/private-uploads
sudo bash /opt/pmis/releases/<release>/deploy/retain-previous-frontend-assets.sh \
  /opt/pmis/current/frontend/dist \
  /opt/pmis/releases/<release>/frontend/dist
# 发布目录必须允许 Nginx 逐级进入；否则前端入口和静态资源会返回 403。
sudo chmod 755 /opt/pmis/releases/<release>
sudo ln -sfn /opt/pmis/releases/<release> /opt/pmis/current
```

保留脚本只把上一版本构建自身的哈希资源补入新版本，不覆盖新构建同名文件，也不会继续传递更早版本已经保留的资源。这样已打开的旧页面在发布切换期间仍能加载原分包，同时避免静态资源无限累积。首次发布或不存在上一版本目录时，脚本会直接跳过。

Nginx 必须对 `index.html` 使用 `no-store`，对 `/assets/` 下的 Vite 哈希资源使用一年 `immutable` 缓存。前端还会在旧分包确实无法加载时自动刷新一次；一分钟内不会循环刷新。

新上传的合同附件、阶段计划交付文件、头像和富文本图片统一写入 OSS。`/opt/pmis/shared/uploads` 与 `/opt/pmis/shared/private-uploads` 仅用于历史迁移兼容；历史迁移和业务抽查通过前必须保留。

查看状态：

```bash
systemctl status pmis-backend postgresql-16
journalctl -u pmis-backend -n 100 --no-pager
namei -l /opt/pmis/current/frontend/dist/index.html
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

仓库配置使用 `client_max_body_size 25m`。PMIS 业务层仍按单文件最大
20MB 校验；Nginx 额外预留 multipart 请求开销，避免合规文件在到达后端和
OSS 前被网关以 HTTP 413 拒绝。正式环境不得继续保留旧的 8MB 上限。

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
