# Task Detail Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the subtask actual completion column and make the task detail back label match the real return target.

**Architecture:** Keep navigation in `usePageReturnNavigation` and derive the label in the task page from its sanitized `returnTarget`. Reuse `TemplateDetailPage.backText` and the existing `TaskRecord.actualEndTime`; do not change APIs or the database.

**Tech Stack:** React, TypeScript, React Router, Node test runner.

## Global Constraints

- Use “返回” only when the target is another task detail route.
- Keep “返回列表” for task list return targets.
- Add “实际完成时间” immediately after “预计完成时间”.
- Do not change APIs, database structure, status transitions, or return target sanitization.

---

### Task 1: Task detail return label and subtask column

**Files:**
- Modify: `frontend/test/taskPageStructure.test.mjs`
- Modify: `frontend/src/modules/task/pages/TaskDetailPage.tsx`

**Interfaces:**
- Consumes: `usePageReturnNavigation('/tasks').returnTarget`, `TemplateDetailPage.backText`, `TaskRecord.actualEndTime`.
- Produces: task-detail-specific `backText` and the additional table column.

- [x] **Step 1: Write failing tests**

Update the task structure tests to require:

```js
assert.match(source, /returnTarget/);
assert.match(source, /backText=\{[^}]*'返回'/);
assert.match(source, /title: '预计完成时间'[\s\S]*title: '实际完成时间'/);
assert.match(source, /task\.actualEndTime \|\| '-'/);
```

- [x] **Step 2: Verify the tests fail**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs`

Expected: the new assertions fail because the page has no dynamic `backText` and no subtask actual completion column.

- [x] **Step 3: Implement the minimal page changes**

Destructure `returnTarget`, detect an exact `/tasks/:id` detail target, pass `backText` to `TemplateDetailPage`, and add:

```tsx
{ title: '实际完成时间', dataIndex: 'actualEndTime', width: 140, render: (_, task) => task.actualEndTime || '-' }
```

immediately after the expected completion column.

- [x] **Step 4: Verify targeted tests and audits pass**

Run:

```bash
cd frontend
node --test test/taskPageStructure.test.mjs
npm run audit:components:strict
```

Expected: all task structure tests pass; component audit reports 0 blockers and 0 reminders.

- [x] **Step 5: Run full delivery verification**

Run: `node scripts/verify-change.mjs`

Expected: frontend tests, component/API audits, production build, and backend tests pass.

- [x] **Step 6: Browser verification**

Verify:

1. Main task detail shows “实际完成时间” after “预计完成时间”.
2. Opening a subtask from the main task detail shows “返回”.
3. Clicking “返回” returns to the main task detail.
4. Opening a task from the list still shows “返回列表”.

- [ ] **Step 7: Commit and push**

```bash
git add frontend/src/modules/task/pages/TaskDetailPage.tsx frontend/test/taskPageStructure.test.mjs docs/superpowers/plans/2026-07-15-task-detail-navigation.md
git commit -m "fix: align subtask detail navigation"
git push origin master
```
