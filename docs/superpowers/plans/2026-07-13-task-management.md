# Task Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PMIS 中完整交付不含历史数据和首页改动的独立任务管理模块。

**Architecture:** 以现有项目、需求模块为后端和页面实现基准，新增 PostgreSQL 任务表、Express REST 接口、React 任务页面和独立菜单权限。业务规则保持源系统一致，通用页面结构、状态操作、历史聚合、上下条导航和运行时契约全部复用 PMIS 现有能力。

**Tech Stack:** React 18、TypeScript、Ant Design、Express 5、PostgreSQL、Node test runner。

## Global Constraints

- 只迁移任务管理功能，不迁移任何任务数据，不改首页，不接 MCP。
- 页面、提示、历史字段、测试和文档统一使用“时间”，不得出现“日期”；数据库保留 `*_date` 字段。
- 数据库物理表使用 `pms_` 前缀，操作者只取 `req.user.id`。
- 页面必须使用 PMIS 现有列表、表单、详情、状态、删除和历史组件。
- 任务来源只能在项目和需求中二选一，业务状态和源系统一致。
- 保护并兼容工作区现有未提交改动，不清理、不覆盖无关文件。
- 不增加新依赖，不做与任务管理无关的重构。

---

### Task 1: 任务规则、数据库结构与关联保护

**Files:**
- Create: `backend/src/services/taskRules.js`
- Create: `backend/db/migrations/20260713_add_task.sql`
- Modify: `backend/db/init/001_schema.sql`
- Modify: `backend/src/controllers/projectController.js`
- Modify: `backend/src/controllers/requirementController.js`
- Modify: `backend/src/controllers/archiveController.js`
- Test: `backend/test/taskRules.test.js`
- Test: `backend/test/taskRelationProtection.test.js`

**Interfaces:**
- Produces: `allowedTaskStatuses(status, previousStatus)`、`validateTaskStatusChange(target, body)`、`resolveTaskStatusFields(old, target, body)`、`calculateTaskOverdue(expectedEndTime, status)`。
- Produces: `pms_task` 表及 `task_type` 基础档案类型，供后端接口和前端选项使用。

- [ ] **Step 1: 写失败测试**：覆盖四态允许/禁止流转、暂停恢复、完成/暂停必填时间、逾期计算、来源二选一及项目/需求/任务类型引用删除保护。
- [ ] **Step 2: 运行失败测试**：执行 `cd backend && node --test test/taskRules.test.js test/taskRelationProtection.test.js`，预期因任务规则和表引用检查不存在而失败。
- [ ] **Step 3: 最小实现规则与结构**：新增纯业务规则；在初始化 SQL 和 migration 中新增 `pms_task`、约束、唯一索引、查询索引、菜单及任务类型档案种子；三个删除控制器只增加任务引用检查。
- [ ] **Step 4: 运行聚焦测试**：再次执行上述命令，预期全部通过。
- [ ] **Step 5: 提交独立改动**：只暂存本任务文件并提交 `feat: add task schema and rules`。

### Task 2: 后端任务接口与聚合历史

**Files:**
- Create: `backend/src/controllers/taskController.js`
- Create: `backend/src/routes/task.js`
- Modify: `backend/src/app.js`
- Test: `backend/test/taskController.test.js`
- Test: `backend/test/taskOperationHistory.test.js`
- Test: `backend/test/operatorIdentity.test.js`

**Interfaces:**
- Consumes: Task 1 的任务规则和 `pms_task` 表。
- Produces: `GET/POST /api/tasks`、`GET/PUT/DELETE /api/tasks/:id`、`PUT /api/tasks/:id/status`、`GET /api/tasks/:id/history`、`GET /api/tasks/neighbors`。

- [ ] **Step 1: 写失败测试**：覆盖列表分页、全部/我的真实计数、筛选排序、详情、创建、编辑、复制所需读取、软删除、名称重复字段错误、来源校验、身份防覆盖、状态后端防绕过、上下条和 `operation_id` 聚合历史。
- [ ] **Step 2: 运行失败测试**：执行 `cd backend && node --test test/taskController.test.js test/taskOperationHistory.test.js test/operatorIdentity.test.js`，预期因接口未实现而失败。
- [ ] **Step 3: 实现统一接口**：复用分页、统一响应、`failField`、日志聚合和现有查询写法；所有写操作使用 `req.user.id`；上下条与列表共享筛选排序；接口权限挂载为 `/tasks`。
- [ ] **Step 4: 运行后端测试**：执行聚焦测试和 `cd backend && npm test`，预期全部通过。
- [ ] **Step 5: 提交独立改动**：只暂存本任务文件并提交 `feat: add task management api`。

### Task 3: 前端类型、API 契约与状态组件

**Files:**
- Create: `frontend/src/modules/task/types.ts`
- Create: `frontend/src/modules/task/statusTransitions.ts`
- Create: `frontend/src/modules/task/helpers.tsx`
- Create: `frontend/src/modules/task/components/TaskStatusChangeAction.tsx`
- Create: `frontend/src/api/taskApi.ts`
- Test: `frontend/test/taskApi.test.ts`
- Test: `frontend/test/taskStatusTransitions.test.mjs`

**Interfaces:**
- Produces: `TaskRecord`、`TaskStatus`、`TaskListParams`、`allowedTaskStatuses(record)`、任务 API CRUD/历史/上下条方法和 `TaskStatusChangeAction`。

- [ ] **Step 1: 写失败测试**：要求 API 使用 `request + unwrap + objectContract/arrayContract`，ID 转字符串，状态目标与后端一致，业务状态组件直接渲染 `StatusChangeAction`。
- [ ] **Step 2: 运行失败测试**：执行 `cd frontend && node --test test/taskApi.test.ts test/taskStatusTransitions.test.mjs`，预期因模块不存在而失败。
- [ ] **Step 3: 实现最小类型和 API 层**：完成后端字段到页面记录的显式转换、列表 `viewCounts`、历史和邻接契约；状态组件只承接任务附加字段和回调。
- [ ] **Step 4: 运行聚焦测试**：再次执行聚焦命令，预期全部通过。
- [ ] **Step 5: 提交独立改动**：只暂存本任务文件并提交 `feat: add task frontend contracts`。

### Task 4: 任务列表、表单与详情页面

**Files:**
- Create: `frontend/src/modules/task/pages/TaskListPage.tsx`
- Create: `frontend/src/modules/task/pages/TaskFormPage.tsx`
- Create: `frontend/src/modules/task/pages/TaskDetailPage.tsx`
- Create: `frontend/src/modules/task/pages/TaskListPage.css`
- Modify: `frontend/test/businessModuleTimeTerminology.test.mjs`
- Test: `frontend/test/taskPageStructure.test.mjs`
- Test: `frontend/test/taskListPageState.test.mjs`

**Interfaces:**
- Consumes: Task 3 类型、API、状态组件及现有 `TemplateListPage`、`TemplateFormPage`、`TemplateDetailPage`、`HistoryTimelineSection`。
- Produces: `/tasks` 对应的列表、新增、复制、编辑、详情完整页面。

- [ ] **Step 1: 写失败测试**：要求列表样板、全部/我的真实计数、固定列和统一操作列；表单样板及字段错误回填；详情状态区、状态动作、历史和上下条；任务模块源码不得出现“日期”。
- [ ] **Step 2: 运行失败测试**：执行 `cd frontend && node --test test/taskPageStructure.test.mjs test/taskListPageState.test.mjs test/businessModuleTimeTerminology.test.mjs`，预期因页面不存在或任务模块未纳入术语门禁而失败。
- [ ] **Step 3: 实现三个页面**：沿用项目/需求页面结构；复制只带业务输入字段；详情邻接参数保持列表筛选排序；不自建原生弹窗、选择器、删除或状态组件。
- [ ] **Step 4: 运行前端测试与审计**：执行聚焦测试、`npm run audit:components:strict`、`npm run audit:api-contracts` 和 `npm run build`，预期零阻断并构建成功。
- [ ] **Step 5: 提交独立改动**：只暂存本任务文件并提交 `feat: add task management pages`。

### Task 5: 路由、菜单、权限和数据库文档

**Files:**
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/layouts/AdminLayout/index.tsx`
- Modify: `frontend/src/modules/role/roleMenuTree.ts`
- Modify: `docs/数据库表结构.md`
- Modify: `docs/数据库表结构.xlsx`
- Test: `frontend/test/taskRoutePermission.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `/api/tasks` 权限和 Task 4 页面。
- Produces: 独立 `/tasks` 菜单权限、子路由继承规则和同步数据库材料。

- [ ] **Step 1: 写失败测试**：要求 `/tasks` 菜单、列表/新增/复制/编辑/详情路由、角色权限树和后端 `checkPermission('/tasks')` 对齐。
- [ ] **Step 2: 运行失败测试**：执行 `cd frontend && node --test test/taskRoutePermission.test.mjs`，预期因路由菜单未注册而失败。
- [ ] **Step 3: 注册入口并同步文档**：任务管理放在需求管理之后、运维工单之前；同步 Markdown 和 Excel 的 `pms_task` 字段、约束、索引和关联说明。
- [ ] **Step 4: 运行权限测试和文档核对**：测试通过，并确认 Excel 与 SQL 字段逐项一致。
- [ ] **Step 5: 提交独立改动**：只暂存本任务文件并提交 `feat: register task management module`。

### Task 6: 迁移执行、完整门禁与浏览器验收

**Files:**
- Modify: `docs/ai-delivery-template.md` 指定的本次交付单文件。

**Interfaces:**
- Consumes: 前五项全部交付。
- Produces: 已迁移数据库、可验收本地环境和完整验证记录。

- [ ] **Step 1: 运行迁移检查**：执行 `cd backend && npm run db:migrate -- --check`，预期只显示 `20260713_add_task.sql` 等尚未执行迁移，不修改数据库。
- [ ] **Step 2: 执行已确认迁移**：执行 `cd backend && npm run db:migrate`，确认 `pms_task` 为空、任务类型档案存在、菜单权限数据存在。
- [ ] **Step 3: 运行完整门禁**：执行 `node scripts/verify-change.mjs`，预期后端测试、前端测试、组件审计、接口契约审计和构建全部通过。
- [ ] **Step 4: 验证真实接口和浏览器流程**：在 `3104` 验收列表、查询、重置、排序、分页、空状态、新增、编辑、复制、详情、状态变更、删除、历史、上下条和权限拒绝；验证所有任务记录来自真实接口和数据库。
- [ ] **Step 5: 恢复并检查服务**：确认 `3103` 健康检查返回 200、`3104` 可访问；若构建或依赖操作停止服务，按项目现有启动方式恢复。
- [ ] **Step 6: 输出交付单**：记录改动范围、迁移文件、验证证据、可验收地址和剩余风险，不包含开发过程流水账。
