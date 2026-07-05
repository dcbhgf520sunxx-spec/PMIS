# 本地启动与数据库初始化

## 环境

- Node.js：项目本地前后端使用 npm 脚本启动。
- 数据库：PostgreSQL 16，使用 Docker Compose。
- 数据库时区：统一使用 `Asia/Shanghai`。
- 默认后端端口：`3101`
- 默认前端端口：`3102`

## 启动 PostgreSQL

```bash
docker compose up -d postgres
```

数据库初始化脚本位于：

```text
backend/db/init/001_schema.sql
```

首次启动容器时会自动创建表结构、索引、默认菜单、默认角色、默认账号和少量样例数据。

## 数据库连接配置

后端读取 `backend/.env`：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=pms
DB_PASSWORD=pms123456
DB_NAME=project_template
JWT_SECRET=project-template-dev-secret
```

## 默认账号

```text
账号：admin
密码：vv123456
```

## 启动后端

```bash
cd backend
npm install
npm start
```

健康检查：

```bash
curl http://localhost:3101/api/health
```

## 启动前端

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 3102
```

访问：

```text
http://localhost:3102
```

## 重新初始化数据库

如果需要清空并重新执行初始化 SQL：

```bash
docker compose down -v
docker compose up -d postgres
```

注意：`down -v` 会删除本地 PostgreSQL 数据卷。

## 旧库表名前缀迁移

如果本地数据库已经初始化过，后续修改 `backend/db/init/001_schema.sql` 不会自动重放。旧库里仍存在 `work_order`、`archive_type`、`archive`、`op_log` 这类无前缀表时，执行：

```bash
docker exec -i project-template-postgres psql -U pms -d project_template < backend/db/migrations/20260704_rename_legacy_tables_to_pms.sql
```

迁移后业务表统一为 `pms_` 前缀。

## 数据库时区迁移

如果本地数据库已经初始化过，需要把数据库和角色默认时区补成中国时区：

```bash
docker exec -i project-template-postgres psql -U pms -d project_template < backend/db/migrations/20260704_set_database_timezone.sql
```

后端连接也会按 `Asia/Shanghai` 会话时区读取 `TIMESTAMPTZ`，接口返回的日期时间不再转成 UTC。

## 工单档案字段迁移

如果本地数据库已经初始化过，需要补充运维工单的所属系统字段、问题类型档案类型和默认档案数据：

```bash
docker exec -i project-template-postgres psql -U pms -d project_template < backend/db/migrations/20260704_work_order_archive_fields.sql
```

迁移会自动补充：

- 档案类型：`系统`，默认档案：`后台管理系统`
- 档案类型：`问题类型`，默认档案：`日常操作`、`系统优化`、`故障报障`、`后台维护`、`其他`

已有的档案分类不会被覆盖。

## 模拟数据补充

如果本地数据库已经初始化过，需要补充用户、角色、工单、方案分类档案和档案分类档案的模拟数据：

```bash
docker exec -i project-template-postgres psql -U pms -d project_template < backend/db/migrations/20260704_seed_demo_50_plus.sql
```

该脚本可重复执行，不会重复追加同一批模拟数据。首次初始化新数据库时，`backend/db/init/002_seed_demo_50_plus.sql` 会自动执行。
