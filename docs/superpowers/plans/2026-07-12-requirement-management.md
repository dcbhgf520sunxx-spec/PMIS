# Requirement Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PMIS 中完整交付空数据起步的需求管理模块。

**Architecture:** 复用产品/项目模块的 PostgreSQL 控制器、API 契约、React 页面样板和操作历史能力；状态矩阵独立放在需求模块业务层，前后端分别校验。

**Tech Stack:** React 18、TypeScript、Ant Design、Express、PostgreSQL、Node test runner。

## Global Constraints

- 不迁移历史数据，不修改任务和缺陷模块。
- 数据库物理表使用 `pms_` 前缀，操作者只取 `req.user.id`。
- 页面必须使用 PMIS 现有样板和公共组件。
- 现有未提交改动不得覆盖或清理。

---

### Task 1: 数据库与后端业务

**Files:** `backend/db/init/001_schema.sql`、`backend/db/migrations/20260712_add_requirement.sql`、`backend/src/services/requirementRules.js`、`backend/src/controllers/requirementController.js`、`backend/src/routes/requirement.js`、`backend/src/app.js`、后端测试。

- [ ] 先写状态流转、逾期、校验和接口防绕过测试并确认失败。
- [ ] 新增表、索引、菜单和空数据 migration。
- [ ] 实现列表、视图计数、详情、增删改、状态流转和聚合历史接口。
- [ ] 运行后端测试并修至通过。

### Task 2: 前端 API 与业务页面

**Files:** `frontend/src/api/requirementApi.ts`、`frontend/src/modules/requirement/**`、`frontend/src/app/routes.tsx`、`frontend/src/layouts/AdminLayout/index.tsx`、前端测试。

- [ ] 先写状态矩阵、API 契约和样板接入测试并确认失败。
- [ ] 实现类型、API 映射、列表、表单、详情和状态动作。
- [ ] 注册路由、菜单和权限入口。
- [ ] 运行前端测试、组件审计和构建并修至通过。

### Task 3: 文档、迁移与实际验收

**Files:** `docs/数据库表结构.md`、`docs/数据库表结构.xlsx`、交付单。

- [ ] 同步 Markdown 和 Excel 表结构。
- [ ] 运行 `node scripts/verify-change.mjs` 和 `cd backend && npm run db:migrate -- --check`。
- [ ] 执行 migration，验证接口真实读写和空数据起步。
- [ ] 浏览器验收列表、筛选、表单、详情、状态、历史、删除和权限拒绝。
- [ ] 检查 3103 健康状态与 3104 页面可访问性。
