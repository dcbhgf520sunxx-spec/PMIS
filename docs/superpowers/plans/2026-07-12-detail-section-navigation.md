# Detail Section Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为长详情页提供可选的顶部分类导航，点击定位、滚动高亮，并在窄屏使用下拉选择。

**Architecture:** `TemplateDetailPage` 通过上下文收集带 `sectionKey` 的 `TemplateDetailSection`，只在显式开启 `sectionNavigation` 时渲染导航。导航与详情内容共用模板内部滚动容器，不侵占右侧状态和单据信息区域；组件工作台用前端长内容验证能力。

**Tech Stack:** React 18、TypeScript、原生 IntersectionObserver、现有 Admin 组件与 CSS。

## Global Constraints

- 不新增依赖，不修改数据库和接口。
- 默认关闭，现有详情页行为和布局保持不变。
- 分类名称只从 `TemplateDetailSection.title` 取得，业务页不维护重复配置。
- 窄屏导航使用现有 `AdminSelect`。

---

### Task 1: 模板导航契约与滚动行为

**Files:**
- Modify: `frontend/src/components/admin/TemplateDetailPage/index.tsx`
- Modify: `frontend/src/components/admin/TemplateDetailPage/index.css`
- Test: `frontend/test/detailSectionNavigation.test.mjs`

**Interfaces:**
- Consumes: `TemplateDetailPage` children 中的 `TemplateDetailSection`。
- Produces: `sectionNavigation?: boolean`、`sectionKey?: string`，以及模板内部顶部导航。

- [ ] **Step 1: Write the failing test**

断言模板公开 `sectionNavigation` / `sectionKey`，使用 IntersectionObserver、点击滚动和窄屏选择器。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/test/detailSectionNavigation.test.mjs`
Expected: FAIL because the navigation contract is absent.

- [ ] **Step 3: Write minimal implementation**

实现可选导航、区块注册、滚动高亮、点击定位与响应式下拉，不改变默认渲染路径。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/test/detailSectionNavigation.test.mjs`
Expected: PASS.

### Task 2: 组件工作台长详情示例

**Files:**
- Modify: `frontend/src/modules/design-system/pages/demos/DetailTemplateDemo.tsx`
- Test: `frontend/test/detailSectionNavigation.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `sectionNavigation` 和 `sectionKey`。
- Produces: 无接口、无数据库依赖的长详情交互示例。

- [ ] **Step 1: Extend the failing test**

断言组件工作台显式开启导航，并至少提供 6 个可定位分类。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/test/detailSectionNavigation.test.mjs`
Expected: FAIL because the demo is still short.

- [ ] **Step 3: Add the long-detail demo**

使用现有详情组件和静态展示数据补齐多个长分组，不新增业务 API 或持久化数据。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/test/detailSectionNavigation.test.mjs`
Expected: PASS.

### Task 3: 规范与完整验收

**Files:**
- Modify: `docs/ai-development-rules.md`
- Test: `frontend/test/detailSectionNavigation.test.mjs`

**Interfaces:**
- Consumes: Task 1 的公共组件能力。
- Produces: 长详情页不得自建锚点导航的开发约束。

- [ ] **Step 1: Add the documentation assertion**

断言规则明确长详情页优先使用模板顶部分类导航。

- [ ] **Step 2: Run the focused test**

Run: `node --test frontend/test/detailSectionNavigation.test.mjs`
Expected: PASS after documentation update.

- [ ] **Step 3: Run full verification**

Run: `node scripts/verify-change.mjs`
Expected: all tests, audits and build pass.

- [ ] **Step 4: Browser smoke test**

打开组件工作台详情模板，点击分类并滚动，确认当前分类高亮；缩小窗口确认切换为下拉定位。
