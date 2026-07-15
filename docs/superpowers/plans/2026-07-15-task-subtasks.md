# Task Subtasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-level subtasks to PMIS task management with inherited business linkage, grouped list/detail presentation, and guarded status behavior.

**Architecture:** Keep all records in `pms_task` and represent hierarchy with nullable `parent_task_id`. Backend endpoints own inheritance and hierarchy validation; the frontend extends the existing task list, form, detail, API mapper, and route rather than adding a second task module.

**Tech Stack:** PostgreSQL 16, Express, Node.js test runner, React, TypeScript, Ant Design Pro components, Vite.

## Global Constraints

- Maximum depth is two levels: main task to subtask only.
- Subtasks inherit source type and project or requirement from the main task and cannot override them.
- Main task completion remains manual; incomplete subtasks block completion.
- No new menu, permission, dependency, component system, or unrelated refactor.
- Database table changes update init SQL, migration, backend code/tests, Markdown, and Excel together.
- Business pages continue to use the existing PMIS templates and common action/status components.

---

### Task 1: Persist task hierarchy

**Files:**
- Modify: `backend/db/init/001_schema.sql`
- Create: `backend/db/migrations/20260715_add_task_parent.sql`
- Modify: `backend/test/taskControllerContract.test.js`
- Modify: `docs/数据库表结构.md`
- Modify: `docs/数据库表结构.xlsx`

**Interfaces:**
- Produces: nullable `pms_task.parent_task_id` self-reference and `idx_task_parent(parent_task_id, is_deleted)`.

- [ ] **Step 1: Write the failing schema contract test**

Add assertions that init SQL and migration contain `parent_task_id BIGINT`, `REFERENCES pms_task(id) ON DELETE RESTRICT`, and `idx_task_parent`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/taskControllerContract.test.js`

Expected: FAIL because `parent_task_id` is absent.

- [ ] **Step 3: Add the minimal schema and documentation changes**

The migration must be idempotent:

```sql
ALTER TABLE pms_task ADD COLUMN IF NOT EXISTS parent_task_id BIGINT;
DO $$ BEGIN
  ALTER TABLE pms_task ADD CONSTRAINT fk_task_parent FOREIGN KEY (parent_task_id) REFERENCES pms_task(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_task_parent ON pms_task(parent_task_id, is_deleted);
```

Update the Excel `pms_task` sheet by following its existing header and style; do not replace the workbook.

- [ ] **Step 4: Run the schema contract test**

Run: `cd backend && node --test test/taskControllerContract.test.js`

Expected: PASS.

### Task 2: Enforce hierarchy and status behavior in the backend

**Files:**
- Modify: `backend/src/services/taskRules.js`
- Modify: `backend/src/controllers/taskController.js`
- Modify: `backend/src/routes/task.js`
- Modify: `backend/test/taskRules.test.js`
- Modify: `backend/test/taskControllerContract.test.js`

**Interfaces:**
- Produces: `POST /tasks/:id/subtasks`, `GET /tasks/:id/subtasks`, hierarchy fields on task rows, and `{ allSubtasksCompleted, parentTaskId }` from status updates.
- Consumes: `pms_task.parent_task_id` from Task 1.

- [ ] **Step 1: Write failing rule and controller contract tests**

Cover these behaviors individually:

```js
assert.equal(canCompleteParent(2, 3), false)
assert.equal(canCompleteParent(3, 3), true)
assert.equal(canLeaveCompletedSubtask(2), false)
```

Controller contracts must require subtask routes, inherited source fields, parent completion checks, delete checks, and response flags.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && node --test test/taskRules.test.js test/taskControllerContract.test.js`

Expected: FAIL because hierarchy rules and endpoints do not exist.

- [ ] **Step 3: Implement minimal rule helpers and endpoints**

Add pure helpers:

```js
function canCompleteParent(completed, total) { return Number(completed) === Number(total) }
function canLeaveCompletedSubtask(parentStatus) { return Number(parentStatus) !== 2 }
```

The create-subtask endpoint loads the active parent, rejects a subtask parent and completed parent, then inserts a new task with inherited `source_type`, `project_id`, `requirement_id`, and `parent_task_id`.

The status endpoint blocks a main task completing with incomplete children and blocks a completed subtask leaving completion while its parent is complete. After completing a subtask, count remaining active children and return the prompt flag only when all are complete.

The update endpoint preserves a subtask's hierarchy and source fields; a main task with active children rejects source changes. The delete endpoint rejects a main task with active children.

- [ ] **Step 4: Run backend task tests**

Run: `cd backend && node --test test/taskRules.test.js test/taskControllerContract.test.js`

Expected: PASS.

### Task 3: Extend frontend contracts and the subtask form route

**Files:**
- Modify: `frontend/src/modules/task/types.ts`
- Modify: `frontend/src/api/taskApi.ts`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/modules/task/pages/TaskFormPage.tsx`
- Modify: `frontend/test/taskPageStructure.test.mjs`
- Modify: `frontend/test/taskRoutePermission.test.mjs`

**Interfaces:**
- Produces: `TaskRecord.parentTaskId`, `parentTaskName`, `childCount`, `completedChildCount`; `createSubtask(parentId, values)`; route `/tasks/:id/subtasks/new`.
- Consumes: backend row fields and subtask endpoint from Task 2.

- [ ] **Step 1: Write failing frontend structure and route tests**

Require the subtask route, `createSubtask`, read-only parent/source display, and a title of “新增子任务”.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs test/taskRoutePermission.test.mjs`

Expected: FAIL because the route and form mode are absent.

- [ ] **Step 3: Implement contracts and form behavior**

Extend the mode union to `create | create-subtask | edit | copy`. In subtask mode, load the parent task, show “所属主任务” and inherited association as read-only values, submit through `createSubtask`, and keep all other fields on existing PMIS form components.

- [ ] **Step 4: Run frontend structure and route tests**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs test/taskRoutePermission.test.mjs`

Expected: PASS.

### Task 4: Present hierarchy in list and detail pages

**Files:**
- Modify: `frontend/src/modules/task/pages/TaskListPage.tsx`
- Modify: `frontend/src/modules/task/pages/TaskListPage.css`
- Modify: `frontend/src/modules/task/pages/TaskDetailPage.tsx`
- Modify: `frontend/src/modules/task/helpers.tsx`
- Modify: `frontend/test/taskPageStructure.test.mjs`

**Interfaces:**
- Consumes: hierarchy fields and APIs from Task 3.
- Produces: grouped hierarchy labels, subtask progress, main-task add action, main detail subtask section, child detail parent link, and completion prompt.

- [ ] **Step 1: Write failing page structure tests**

Require controlled main/subtask tags, child indentation, progress text, “新增子任务” only for main tasks, a main detail “子任务” section, and the completion prompt text.

- [ ] **Step 2: Run the page test to verify it fails**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs`

Expected: FAIL because hierarchy presentation is absent.

- [ ] **Step 3: Implement the minimal list and detail changes**

Use existing `CategoryTag`, `OperationColumnActions`, `AdminTextAction`, `DeleteConfirmAction`, status renderers, `TemplateDetailSection`, and `SearchTable`. Do not create business-specific modal infrastructure; use `App.modal.confirm` only for the informational completion prompt, and open the existing `TaskStatusChangeAction` flow from the main task detail.

- [ ] **Step 4: Run the task page tests**

Run: `cd frontend && node --test test/taskPageStructure.test.mjs`

Expected: PASS.

### Task 5: Migrate and verify the complete delivery chain

**Files:**
- Verify all files from Tasks 1-4.
- Create: `docs/2026-07-15-任务子任务交付单.md`

**Interfaces:**
- Consumes: completed database, backend, and frontend implementation.
- Produces: migrated local database and verified local acceptance environment.

- [ ] **Step 1: Check and execute the confirmed migration**

Run: `cd backend && npm run db:migrate -- --check && npm run db:migrate`

Expected: `20260715_add_task_parent.sql` is applied and recorded.

- [ ] **Step 2: Run focused and full automated checks**

Run:

```bash
cd backend && npm test
cd frontend && node --test test/taskPageStructure.test.mjs test/taskRoutePermission.test.mjs
cd frontend && npm run build
node scripts/verify-change.mjs
```

Expected: all commands exit 0.

- [ ] **Step 3: Restart affected services and verify health**

Confirm `http://127.0.0.1:3103/api/health` returns 200 with connected DB and `http://127.0.0.1:3104` returns 200.

- [ ] **Step 4: Perform browser acceptance**

Verify create subtask, inherited association, list hierarchy, main detail subtask table, child parent link, incomplete-child completion rejection, final-child prompt, delete rejection, and no third-level entry.

- [ ] **Step 5: Write the delivery note**

Record changed scope, migration, automated evidence, browser evidence, affected pages, and residual risks without process narration.
