# BUG Activation Reason Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 BUG 被激活状态增加必填激活原因，并按确认顺序展示处理信息。

**Architecture:** 在现有 `pms_bug` 主表保存当前激活原因，状态规则服务负责校验和字段清理，控制器统一写入数据库及聚合日志；前端继续复用状态动作、详情模板和运行时契约。历次原因由现有 `pms_op_log` 保存，不新增记录表。

**Tech Stack:** PostgreSQL 16、Express、React、TypeScript、Ant Design Pro Components、Node Test。

## Global Constraints

- 只修改 BUG 管理相关文件和数据库结构文档，不改首页及无关模块。
- 业务页面继续复用现有页面样板和公共组件，不新增依赖。
- 数据库物理字段为 `activation_reason`，前端 record 字段为 `activationReason`。
- 页面用户可见字段统一命名为“激活原因”，最多 500 字。
- 数据库结构已由用户于 2026-07-14 确认，可在实现后执行 migration。

---

### Task 1: 状态规则与数据库契约

**Files:**
- Modify: `backend/test/bugRules.test.js`
- Modify: `backend/test/bugSchemaContract.test.js`
- Modify: `backend/src/services/bugRules.js`
- Modify: `backend/db/init/001_schema.sql`
- Create: `backend/db/migrations/20260714_add_bug_activation_reason.sql`

**Interfaces:**
- Consumes: `validateBugStatusChange(target, body)`、`resolveBugStatusFields(old, target, body)`。
- Produces: `activationReason` 状态结果和 `pms_bug.activation_reason`。

- [ ] **Step 1: 写失败测试**：断言目标状态 3 缺少/超长原因被拒绝，合法原因被 trim；离开状态 3 时原因清空；初始化 SQL 和 migration 都包含字段、回填及检查约束。
- [ ] **Step 2: 运行失败测试**：`cd backend && node --test test/bugRules.test.js test/bugSchemaContract.test.js`，预期因缺少 `activation_reason` 失败。
- [ ] **Step 3: 最小实现**：扩展规则服务；初始化 SQL 增加 `activation_reason TEXT` 和状态约束；migration 增加字段、回填现有被激活 BUG 并添加约束。
- [ ] **Step 4: 运行通过测试**：重复 Step 2，预期全部通过。

### Task 2: 后端接口与历史

**Files:**
- Modify: `backend/test/bugControllerContract.test.js`
- Modify: `backend/src/controllers/bugController.js`

**Interfaces:**
- Consumes: Task 1 返回的 `activationReason`。
- Produces: 详情字段 `activation_reason`，状态接口持久化及历史中文转译。

- [ ] **Step 1: 写失败测试**：断言控制器读取、更新、记录并转译 `activation_reason`，字段顺序紧跟状态。
- [ ] **Step 2: 运行失败测试**：`cd backend && node --test test/bugControllerContract.test.js`，预期因控制器未接入字段失败。
- [ ] **Step 3: 最小实现**：状态查询加入字段，UPDATE 写入字段，日志变更加入字段，历史标签映射为“激活原因”。
- [ ] **Step 4: 运行通过测试**：重复 Step 2，预期全部通过。

### Task 3: 前端状态弹窗与详情展示

**Files:**
- Modify: `frontend/test/bugStatusTransitions.test.mjs`
- Modify: `frontend/test/bugPageStructure.test.mjs`
- Modify: `frontend/src/modules/bug/types.ts`
- Modify: `frontend/src/api/bugApi.ts`
- Modify: `frontend/src/modules/bug/components/BugStatusChangeAction.tsx`
- Modify: `frontend/src/modules/bug/pages/BugDetailPage.tsx`

**Interfaces:**
- Consumes: 后端 `activation_reason`。
- Produces: `BugRecord.activationReason`、状态载荷 `activation_reason`、详情条件展示。

- [ ] **Step 1: 写失败测试**：断言被激活目标渲染必填激活原因，API 发送字段，详情顺序为解决方案在关闭时间之前且激活原因独占一行。
- [ ] **Step 2: 运行失败测试**：`cd frontend && node --test test/bugStatusTransitions.test.mjs test/bugPageStructure.test.mjs`，预期因字段未接入失败。
- [ ] **Step 3: 最小实现**：扩展类型/API；使用现有多行输入组件；详情只在状态 3 时追加全宽激活原因。
- [ ] **Step 4: 运行测试和构建**：运行 Step 2 以及 `npm run build`，预期全部通过。

### Task 4: 数据库文档、迁移与验收

**Files:**
- Modify: `docs/数据库表结构.md`
- Modify: `docs/数据库表结构.xlsx`
- Modify: `docs/2026-07-13-BUG管理迁移交付单.md`

**Interfaces:**
- Consumes: Tasks 1-3 最终字段规则。
- Produces: 已执行 migration、同步文档和可验收服务。

- [ ] **Step 1: 同步文档**：Markdown 和 Excel 的 `pms_bug` 增加 `activation_reason TEXT`、状态约束和展示说明，Excel 保留现有样式并渲染检查。
- [ ] **Step 2: 执行 migration**：`cd backend && npm run db:migrate -- --check && npm run db:migrate`，预期只执行 `20260714_add_bug_activation_reason.sql`。
- [ ] **Step 3: 真实接口验证**：验证被激活缺少原因失败、填写原因成功、详情返回原因、离开后清空、历史保留中文原因。
- [ ] **Step 4: 完整门禁与服务检查**：运行 `node scripts/verify-change.mjs`，确认 `3103` 健康检查 200、`3104` 可访问并完成浏览器详情/状态弹窗验收。
