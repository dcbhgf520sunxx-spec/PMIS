# Project And Requirement Overdue Filter Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目、需求查询区的“是否逾期”统一改为“逾期状态”。

**Architecture:** 仅替换两个列表页筛选声明中的 `label` 文案，保留现有筛选键、选项和请求逻辑。通过页面结构测试防止旧文案恢复。

**Tech Stack:** React、TypeScript、Node.js 原生测试。

## Global Constraints

- 不修改查询逻辑、接口或数据库。
- 不新增组件。
- 当前工作区存在用户的其他未提交改动，本次不创建 Git 提交。

---

### Task 1: 统一逾期筛选名称

**Files:**
- Modify: `frontend/test/projectListDateAndOverdueColumns.test.mjs`
- Modify: `frontend/test/requirementPageStructure.test.mjs`
- Modify: `frontend/src/modules/project/pages/ProjectListPage.tsx`
- Modify: `frontend/src/modules/requirement/pages/RequirementListPage.tsx`

**Interfaces:**
- Consumes: 现有 `isOverdue` 筛选值及 `AdminSelect`。
- Produces: 两个查询区统一的“逾期状态”标签。

- [ ] **Step 1: 增加失败测试**

分别断言两个列表页存在“逾期状态”筛选标签且不存在“是否逾期”。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && node --test test/projectListDateAndOverdueColumns.test.mjs test/requirementPageStructure.test.mjs`

Expected: 两个页面仍使用“是否逾期”，测试失败。

- [ ] **Step 3: 替换两个标签文案**

将两个筛选声明中的 `label: '是否逾期'` 改为 `label: '逾期状态'`。

- [ ] **Step 4: 完成验证**

Run: `node scripts/verify-change.mjs`

Expected: 测试、审计和构建全部通过；浏览器两个查询区显示“逾期状态”。
