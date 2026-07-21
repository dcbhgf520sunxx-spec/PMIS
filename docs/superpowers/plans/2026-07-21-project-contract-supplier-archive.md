# 项目合同供应商基础档案关联 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 隐藏合同表单所属项目，统一金额单位，并将供应商从自由文本改为受基础档案约束的真实关联。

**Architecture:** `pms_project_contract` 保存 `supplier_id` 并通过 `pms_archive` 查询供应商名称；供应商选项复用登录用户可访问的档案选项接口。迁移创建“供应商”档案类型并把历史文本供应商转成档案后关联，前端只提交档案 ID。

**Tech Stack:** PostgreSQL、Express、React、TypeScript、Ant Design Pro、Node test runner。

## Global Constraints

- 数据库表继续使用 `pms_` 前缀，不新增依赖。
- 供应商必须来自启用且未删除的“供应商”基础档案。
- 被有效合同引用的供应商档案不得删除。
- 当前范围仅调整项目合同表单、合同接口和对应结构文档。
- 本批改动按用户要求暂不单独提交 Git。

---

### Task 1: 数据库关联与数据迁移

**Files:**
- Modify: `backend/db/init/001_schema.sql`
- Create: `backend/db/migrations/20260721_01_link_contract_supplier_archive.sql`
- Modify: `backend/test/projectContractSchema.test.js`

**Interfaces:**
- Produces: `pms_project_contract.supplier_id BIGINT NOT NULL REFERENCES pms_archive(id) ON DELETE RESTRICT`
- Produces: 档案类型 `supplier / SUP / 供应商`

- [x] 在结构测试中要求 `supplier_id`、外键、索引、供应商档案类型和历史文本迁移。
- [x] 运行 `node --test backend/test/projectContractSchema.test.js`，确认因结构未实现而失败。
- [x] 同步初始化 SQL 和增量迁移：创建供应商类型、迁移历史名称、设置非空外键和索引、删除 `supplier_name`。
- [x] 重跑结构测试并确认通过。

### Task 2: 后端合同接口和删除保护

**Files:**
- Modify: `backend/src/controllers/projectContractController.js`
- Modify: `backend/src/controllers/archiveController.js`
- Modify: `backend/test/projectContractRules.test.js`
- Modify: `backend/test/projectContractHttpIntegration.test.js`

**Interfaces:**
- Consumes: 请求字段 `supplier_id`
- Produces: 合同响应字段 `supplier_id`、`supplier_name`、`supplier_status`

- [x] 先补供应商类型、启用状态、合同引用删除保护和接口返回字段测试。
- [x] 运行合同相关后端测试，确认因旧文本实现而失败。
- [x] 查询时关联 `pms_archive`；保存时校验档案类型与启用状态；日志继续记录供应商名称。
- [x] 在档案删除保护中统计有效合同引用。
- [x] 重跑合同和档案相关测试并确认通过。

### Task 3: 合同表单接入基础档案

**Files:**
- Modify: `frontend/src/modules/project/pages/ProjectContractFormPage.tsx`
- Modify: `frontend/src/modules/project/components/ProjectPaymentStageEditor.tsx`
- Modify: `frontend/src/api/projectApi.ts`
- Modify: `frontend/src/modules/project/types.ts`
- Modify: `frontend/test/projectContractFeature.test.mjs`

**Interfaces:**
- Consumes: `getArchiveOptionsByTypeName('供应商')`
- Produces: `ProjectContractFormValues.supplierId`

- [x] 先补测试：不展示“所属项目”，使用 `AdminProFormSelect`，合同金额与计划金额带“（元）”，请求提交 `supplier_id`。
- [x] 运行 `node --test frontend/test/projectContractFeature.test.mjs`，确认因旧表单实现而失败。
- [x] 加载供应商选项并复用 `AdminProFormSelect`；移除项目名称字段与无用状态；更新 API 映射和类型。
- [x] 重跑前端合同专项测试并确认通过。

### Task 4: 结构文档、迁移与验收

**Files:**
- Modify: `docs/数据库表结构.md`
- Modify: `docs/数据库表结构.xlsx`

**Interfaces:**
- Consumes: 已确认的 `supplier_id` 表结构设计
- Produces: 与 SQL 一致的 Markdown、Excel 和本地数据库结构

- [x] 更新两份数据库结构文档并核对字段、外键和索引。
- [x] 执行 `cd backend && npm run db:migrate -- --apply --user-approved`。
- [x] 运行 `node scripts/verify-change.mjs`、数据库接口读写和 3103/3104 健康检查。
- [x] 在浏览器验证合同新增/编辑页的供应商下拉、金额单位、付款阶段增删和失败校验。
