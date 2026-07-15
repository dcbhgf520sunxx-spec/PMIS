# Requirement And Task Handling Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一需求、任务新增编辑页和详情页的字段分组，并将负责人放到处理信息第一项。

**Architecture:** 仅调整现有业务页面传给表单和详情样板的字段顺序。表单继续复用 `TemplateFormPage`，详情继续复用 `TemplateDetailPage`，不引入新组件和数据变更。

**Tech Stack:** React、TypeScript、Ant Design Pro、Node.js 原生测试。

## Global Constraints

- 优先复用现有页面样板和 `AdminProForm*`、`DetailMetaList` 组件。
- 不修改接口、数据库、校验和状态逻辑。
- 不改需求、任务以外的业务文件。
- 当前工作区存在用户的其他未提交改动，本次不创建 Git 提交。

---

### Task 1: 锁定需求字段分组

**Files:**
- Modify: `frontend/test/requirementPageStructure.test.mjs`
- Modify: `frontend/src/modules/requirement/pages/RequirementFormPage.tsx`
- Modify: `frontend/src/modules/requirement/pages/RequirementDetailPage.tsx`

**Interfaces:**
- Consumes: 现有 `TemplateFormSection`、`TemplateDetailSection` 和字段 `ownerId` / `ownerName`。
- Produces: 需求表单与详情一致的基本信息、处理信息顺序。

- [ ] **Step 1: 写入失败的结构测试**

断言负责人不在基本信息片段中，并且在处理信息片段中排在提出人之前。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && node --test test/requirementPageStructure.test.mjs`

Expected: 负责人仍在基本信息，测试失败。

- [ ] **Step 3: 最小调整需求表单与详情**

将 `ownerId` / `ownerName` 从基本信息移动到处理信息首项，其他字段保持原顺序。

- [ ] **Step 4: 运行需求结构测试**

Run: `cd frontend && node --test test/requirementPageStructure.test.mjs`

Expected: 全部通过。

### Task 2: 锁定任务字段分组

**Files:**
- Modify: `frontend/test/taskPageStructure.test.mjs`
- Modify: `frontend/src/modules/task/pages/TaskFormPage.tsx`
- Modify: `frontend/src/modules/task/pages/TaskDetailPage.tsx`

**Interfaces:**
- Consumes: 现有 `TemplateFormSection`、`TemplateDetailSection` 和任务处理时间字段。
- Produces: 任务基本信息与处理信息的统一分组。

- [ ] **Step 1: 写入失败的结构测试**

断言表单和详情的处理信息均以负责人开头；启动时间、预计完成时间及详情状态产生的实际完成时间、暂停时间均处于处理信息。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs`

Expected: 任务表单没有处理信息分组，测试失败。

- [ ] **Step 3: 最小调整任务表单与详情**

基本信息保留任务名称、描述、关联字段、任务类型和优先级；新增处理信息分组并依次放入负责人、启动时间、预计完成时间。详情同步移动负责人。

- [ ] **Step 4: 运行任务结构测试**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs`

Expected: 全部通过。

### Task 3: 完整门禁与页面验收

**Files:**
- Verify only: `frontend/src/modules/requirement/pages/*`
- Verify only: `frontend/src/modules/task/pages/*`

**Interfaces:**
- Consumes: 调整后的需求、任务页面。
- Produces: 可供用户验收的本地页面。

- [ ] **Step 1: 运行完整交付门禁**

Run: `node scripts/verify-change.mjs`

Expected: 前后端测试、组件审计、接口契约审计和构建全部通过。

- [ ] **Step 2: 浏览器验证**

打开需求和任务新增页、各一个详情页，检查分组标题、负责人首项、字段顺序、页面错误和控制台日志。

- [ ] **Step 3: 检查服务**

Run: `curl` 检查 `http://127.0.0.1:3103/api/health` 与 `http://127.0.0.1:3104`。

Expected: 均返回 HTTP 200。
