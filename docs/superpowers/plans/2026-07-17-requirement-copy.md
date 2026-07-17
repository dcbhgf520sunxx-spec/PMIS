# 需求复制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在需求列表中增加复制动作，并通过现有需求表单创建一条回填源数据的新需求。

**Architecture:** 复用 `RequirementFormPage` 和 `createRequirement`，仅新增复制路由与表单模式。复制页读取源需求并回填可编辑字段，不新增接口或数据库结构。

**Tech Stack:** React、TypeScript、React Router、Ant Design Pro Form、Node.js 静态契约测试。

## Global Constraints

- 优先复用现有页面样板和操作列组件。
- 操作顺序固定为“编辑、状态变更、复制、删除”。
- 不复制流程状态、实际完成时间、暂停时间和变更历史。
- 不新增依赖、接口或数据库结构。

---

### Task 1: 需求复制路由与表单模式

**Files:**
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/modules/requirement/pages/RequirementFormPage.tsx`
- Modify: `frontend/src/modules/requirement/pages/RequirementListPage.tsx`
- Test: `frontend/test/requirementPageStructure.test.mjs`

**Interfaces:**
- Consumes: `getRequirement(id)`、`createRequirement(values)`、`usePageReturnNavigation('/requirements')`
- Produces: `/requirements/:id/copy` 路由和 `RequirementFormPage` 的 `mode: 'copy'`

- [ ] **Step 1: Write the failing test**

```js
test('需求列表复制动作进入复制表单并创建新需求', () => {
  assert.match(listPage, /\/requirements\/\$\{row\.id\}\/copy/);
  assert.match(routes, /requirements\/:id\/copy[\s\S]*RequirementFormPage mode="copy"/);
  assert.match(formPage, /mode:'create'\|'edit'\|'copy'/);
  assert.match(formPage, /mode==='copy'\?'复制需求'/);
  assert.match(formPage, /mode==='edit'[\s\S]*updateRequirement[\s\S]*createRequirement/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/test/requirementPageStructure.test.mjs`

Expected: FAIL because the copy route and form mode do not exist.

- [ ] **Step 3: Write minimal implementation**

Add the copy action after status change, register the copy route, load source data whenever the mode is not `create`, show title “复制需求”, and call `createRequirement` for both `create` and `copy` modes.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/test/requirementPageStructure.test.mjs`

Expected: all requirement structure tests PASS.

- [ ] **Step 5: Verify delivery gates and browser flow**

Run: `node scripts/verify-change.mjs`

Expected: frontend tests, lint, component audits, API contract audit, build and backend tests all pass. Then open the requirement list, click “复制”, verify form prefill, duplicate-title field error, successful creation with a new title, and return to the original list state.
