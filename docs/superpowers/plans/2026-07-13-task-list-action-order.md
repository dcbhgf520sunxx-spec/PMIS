# Task List Action Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 调整任务列表单条操作顺序，使状态变更位于复制之前。

**Architecture:** 保留现有 `OperationColumnActions` 及全部动作实现，只交换 JSX 子节点顺序。通过页面结构测试锁定顺序，并用浏览器检查直显与“更多”菜单。

**Tech Stack:** React、TypeScript、Node.js 原生测试。

## Global Constraints

- 不修改动作逻辑、接口、权限或数据库。
- 不新建业务组件。
- 当前工作区存在用户的其他未提交改动，本次不创建 Git 提交。

---

### Task 1: 调整任务列表动作顺序

**Files:**
- Modify: `frontend/test/taskPageStructure.test.mjs`
- Modify: `frontend/src/modules/task/pages/TaskListPage.tsx`

**Interfaces:**
- Consumes: `OperationColumnActions`、`AdminTextAction`、`TaskStatusChangeAction`、`DeleteConfirmAction`。
- Produces: “编辑、状态变更、复制、删除”的操作声明顺序。

- [ ] **Step 1: 写入失败的顺序测试**

截取任务列表操作列，断言“编辑 < 状态变更 < 复制 < 删除”。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs`

Expected: 当前“复制”仍位于“状态变更”之前，测试失败。

- [ ] **Step 3: 交换两个动作的位置**

在 `OperationColumnActions` 中将 `TaskStatusChangeAction` 移到复制动作之前，动作内部实现保持不变。

- [ ] **Step 4: 验证测试与页面**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs`

Expected: 全部通过；随后运行 `node scripts/verify-change.mjs` 并在浏览器检查操作列。
