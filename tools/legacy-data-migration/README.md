# 旧项目管理数据迁移

本工具只用于把已确认的旧 MySQL 快照迁移到全新初始化并登记 migration 基线的 PMIS PostgreSQL 数据库。

迁移用户、角色、用户角色、任务类型、产品、项目、项目成员、需求、任务和非里程碑操作日志。明确丢弃里程碑、里程碑日志、MCP 审计数据；不读取旧角色菜单，而是按新 PMIS 菜单编码重建权限。

所有数据库凭据都通过环境变量传入，报告只记录连接摘要和数量，不记录密码。

```bash
npm ci
npm test

# 只读检查源库快照
npm run migrate -- --report /path/to/precheck.json

# 正式导入，只允许导入全新目标库
npm run migrate -- --apply --user-approved --report /path/to/import.json

# 导入后核对数量和关键关联
npm run migrate -- --verify --report /path/to/verify.json
```

必须提供以下环境变量：

- `LEGACY_DB_HOST`、`LEGACY_DB_PORT`、`LEGACY_DB_USER`、`LEGACY_DB_PASSWORD`、`LEGACY_DB_NAME`
- `TARGET_DB_HOST`、`TARGET_DB_PORT`、`TARGET_DB_USER`、`TARGET_DB_PASSWORD`、`TARGET_DB_NAME`

工具对源库已确认数量做硬校验。预检查后只要源数据数量变化，就会拒绝导入，必须重新核对迁移范围。
