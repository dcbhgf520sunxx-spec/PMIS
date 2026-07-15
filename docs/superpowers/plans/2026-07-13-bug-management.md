# BUG Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PMIS 中完整交付 BUG 管理模块，并生成 60 条可验收模拟数据及变更历史。

**Architecture:** 以现有任务模块为页面、接口、权限和历史基准，新增 PostgreSQL BUG 表、Express REST 接口、React 列表/表单/详情和独立菜单。BUG 类型与解决方案通过现有基础档案管理，状态规则由前后端共同防绕过。

**Tech Stack:** React 18、TypeScript、Ant Design、Express 5、PostgreSQL、Node test runner、`@oai/artifact-tool`。

## Global Constraints

- 不迁移旧 BUG 数据，不改首页，生成 60 条新模拟 BUG 和对应变更历史。
- BUG 类型和 BUG 解决方案必须使用基础档案，业务页不得写死选项。
- 页面、提示、历史、测试和文档统一使用“时间”，数据库可保留 `*_date` 字段。
- 数据库物理表使用 `pms_` 前缀，写操作操作人只取 `req.user.id`。
- 页面必须使用 PMIS 现有列表、表单、详情、状态、删除、历史和分类标签组件。
- 保护并兼容工作区现有未提交改动，不清理、不覆盖无关文件。
- 不增加新业务依赖，不做与 BUG 管理无关的重构。

---

### Task 1: BUG 规则、数据库结构与基础档案

**Files:**
- Create: `backend/src/services/bugRules.js`
- Create: `backend/db/migrations/20260713_add_bug.sql`
- Modify: `backend/db/init/001_schema.sql`
- Modify: `backend/src/controllers/archiveController.js`
- Modify: `backend/src/controllers/projectController.js`
- Modify: `backend/src/controllers/requirementController.js`
- Test: `backend/test/bugRules.test.js`
- Test: `backend/test/bugSchemaContract.test.js`

**Interfaces:**
- Produces: `allowedBugStatuses(status)`、`validateBugStatusChange(target, body)`、`resolveBugStatusFields(old, target, body)`。
- Produces: `pms_bug`、`bug_type`、`bug_resolution` 以及 BUG 引用删除保护。

- [ ] **Step 1: 写失败测试**：要求四态流转矩阵、修复/关闭必填字段、离开状态清理规则、来源二选一、两类档案外键和关联删除保护。
- [ ] **Step 2: 运行失败测试**：`cd backend && node --test test/bugRules.test.js test/bugSchemaContract.test.js`，预期因规则和结构未存在失败。
- [ ] **Step 3: 最小实现**：新增纯规则服务；在初始化 SQL 和 migration 中新增 `pms_bug`、检查约束、外键、未删除标题唯一索引、查询索引、菜单和两类基础档案种子；只在现有删除控制器增加 BUG 引用检查。
- [ ] **Step 4: 运行聚焦测试**：再次执行 Step 2，预期全部通过。

### Task 2: BUG 后端接口与变更历史

**Files:**
- Create: `backend/src/controllers/bugController.js`
- Create: `backend/src/routes/bug.js`
- Modify: `backend/src/app.js`
- Test: `backend/test/bugControllerContract.test.js`
- Test: `backend/test/bugOperationHistory.test.js`
- Test: `backend/test/operatorIdentity.test.js`

**Interfaces:**
- Consumes: Task 1 规则、`pms_bug` 和基础档案。
- Produces: `/api/bugs` 列表、详情、选项、唯一校验、新增、编辑、批量指派、状态、删除、历史和上下条接口。

- [ ] **Step 1: 写失败测试**：覆盖服务端分页排序、全部/我的真实计数、组合筛选、标题字段错误、真实关联与档案校验、身份防覆盖、状态后端防绕过、批量指派、上下条和中文历史。
- [ ] **Step 2: 运行失败测试**：`cd backend && node --test test/bugControllerContract.test.js test/bugOperationHistory.test.js test/operatorIdentity.test.js`，预期因接口未存在失败。
- [ ] **Step 3: 实现统一接口**：复用现有分页、视图计数、统一响应、`failField`、`translateHistoryEntries`和 `req.user.id`；列表与上下条共用筛选排序构建器；挂载 `checkPermission('/bugs')`。
- [ ] **Step 4: 运行后端测试**：运行聚焦测试及 `cd backend && npm test`，预期全部通过。

### Task 3: 前端契约、状态组件与 BUG 页面

**Files:**
- Create: `frontend/src/modules/bug/types.ts`
- Create: `frontend/src/modules/bug/statusTransitions.ts`
- Create: `frontend/src/modules/bug/helpers.tsx`
- Create: `frontend/src/modules/bug/components/BugStatusChangeAction.tsx`
- Create: `frontend/src/modules/bug/pages/BugListPage.tsx`
- Create: `frontend/src/modules/bug/pages/BugFormPage.tsx`
- Create: `frontend/src/modules/bug/pages/BugDetailPage.tsx`
- Create: `frontend/src/modules/bug/pages/BugListPage.css`
- Create: `frontend/src/modules/bug/pages/useBugBatchActions.tsx`
- Create: `frontend/src/api/bugApi.ts`
- Test: `frontend/test/bugStatusTransitions.test.mjs`
- Test: `frontend/test/bugPageStructure.test.mjs`

**Interfaces:**
- Produces: `BugRecord`、`BugStatus`、`allowedBugStatuses(record)`、BUG API CRUD/历史/上下条方法、`BugStatusChangeAction` 和三类真实接口页面。

- [ ] **Step 1: 写失败测试**：要求运行时返回契约、与后端一致的状态矩阵、列表样板和批量模式、基础档案选项、标题/富文本整行、处理信息、详情状态区、变更历史和上下条。
- [ ] **Step 2: 运行失败测试**：`cd frontend && node --test test/bugStatusTransitions.test.mjs test/bugPageStructure.test.mjs`，预期因模块未存在失败。
- [ ] **Step 3: 实现最小前端模块**：显式转换后端字段；复用任务分类标签色彩、统一样板、操作列、删除、状态和历史组件；标题复制时原样回填；所有 BUG 类型和解决方案选项来自档案接口。
- [ ] **Step 4: 运行前端测试与审计**：执行聚焦测试、`npm run audit:components:strict`、`npm run audit:api-contracts` 和 `npm run build`，预期零阻断且构建成功。

### Task 4: 路由、菜单、模拟数据和数据库文档

**Files:**
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/layouts/AdminLayout/index.tsx`
- Modify: `docs/数据库表结构.md`
- Modify: `docs/数据库表结构.xlsx`
- Create: `backend/db/migrations/20260713_seed_bug_mock_data.sql`
- Test: `frontend/test/bugRoutePermission.test.mjs`
- Test: `backend/test/bugMockDataContract.test.js`

**Interfaces:**
- Consumes: Task 1-3 的数据表、接口和页面。
- Produces: `/bugs` 独立权限入口、60 条可重复执行的模拟数据种子和与 SQL 一致的 Markdown/Excel。

- [ ] **Step 1: 写失败测试**：要求菜单、列表/新增/复制/编辑/详情路由和后端权限对齐；模拟 migration 必须使用真实关联、生成 60 条 BUG 和变更历史，并具备幂等保护。
- [ ] **Step 2: 运行失败测试**：`cd frontend && node --test test/bugRoutePermission.test.mjs` 与 `cd backend && node --test test/bugMockDataContract.test.js`，预期因入口和种子未存在失败。
- [ ] **Step 3: 注册入口与生成模拟数据**：BUG 管理排在任务管理之后；种子 SQL 从现有项目、需求、用户和档案取有效 ID，以固定模拟标题前缀判断是否已生成，状态字段与日志保持一致。
- [ ] **Step 4: 同步数据库文档**：在 Markdown 和 Excel 中新增 `pms_bug` 字段、约束、索引、外键和两类基础档案；使用 `@oai/artifact-tool` 保留现有工作簿样式并完成渲染检查。
- [ ] **Step 5: 运行权限、模拟数据和文档契约测试**，预期全部通过。

### Task 5: 迁移、完整门禁和真实验收

**Files:**
- Modify: `docs/ai-delivery-template.md` 指定的本次交付记录。

**Interfaces:**
- Consumes: Task 1-4 全部交付。
- Produces: 已执行迁移、可验收服务和完整验证证据。

- [ ] **Step 1: 运行迁移检查**：`cd backend && npm run db:migrate -- --check`，预期显示 BUG 结构与模拟数据 migration 尚未执行，不修改数据库。
- [ ] **Step 2: 执行已确认迁移**：`cd backend && npm run db:migrate`，确认 `pms_bug` 有 60 条模拟数据、两类档案各 6 项、菜单权限存在且日志数量与状态匹配。
- [ ] **Step 3: 运行完整门禁**：`node scripts/verify-change.mjs`，预期前后端测试、组件审计、API 契约审计和构建全部通过。
- [ ] **Step 4: 验证真实接口**：验证列表返回 60 条及真实计数，完成新增、编辑、标题重复、状态变更、批量指派、删除、历史和上下条接口校验。
- [ ] **Step 5: 执行 3104 浏览器验收**：验收列表、筛选、重置、排序、分页、批量操作、新增、编辑、复制、详情、状态、变更历史、上下条和权限拒绝。
- [ ] **Step 6: 恢复并检查服务**：确认 3103 健康检查返回 200、3104 可访问；如构建或迁移影响进程，按项目现有方式恢复。
