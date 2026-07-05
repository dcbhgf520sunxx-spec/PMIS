# Core Page Template Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn list, form, and detail pages into reusable template entry components, then migrate user, role, and work-order pages onto those entries.

**Architecture:** Add three page-level admin components under `frontend/src/components/admin`: `TemplateListPage`, `TemplateFormPage`, and `TemplateDetailPage`. Business pages still own fields, API calls, and business actions, but page shell, layout rhythm, panels, grid, pagination, and detail sections come from template entries.

**Tech Stack:** React, TypeScript, Ant Design, Ant Design Pro Components, existing admin components.

---

### Task 1: Template Entry Components

**Files:**
- Create: `frontend/src/components/admin/TemplateListPage/index.tsx`
- Create: `frontend/src/components/admin/TemplateFormPage/index.tsx`
- Create: `frontend/src/components/admin/TemplateFormPage/index.css`
- Create: `frontend/src/components/admin/TemplateDetailPage/index.tsx`
- Create: `frontend/src/components/admin/TemplateDetailPage/index.css`
- Modify: `frontend/src/components/admin/index.ts`

- [ ] Add a list template that wraps `PageShell`, `DataListPage`, and `TablePagination`.
- [ ] Add a form template that wraps `PageShell compact`, top `ActionBar`, `FormPage`, loading state, panel sections, and shared grid classes.
- [ ] Add a detail template that wraps `PageShell compact`, top actions, main/aside regions, and shared panel sections.
- [ ] Export all three templates from the admin component barrel.

### Task 2: Migrate User and Role Pages

**Files:**
- Modify: `frontend/src/modules/user/pages/UserListPage.tsx`
- Modify: `frontend/src/modules/user/pages/UserFormPage.tsx`
- Modify: `frontend/src/modules/user/pages/UserDetailPage.tsx`
- Modify: `frontend/src/modules/role/pages/RoleListPage.tsx`
- Modify: `frontend/src/modules/role/pages/RoleFormPage.tsx`
- Modify: `frontend/src/modules/role/pages/RoleDetailPage.tsx`

- [ ] Replace list shell composition with `TemplateListPage`.
- [ ] Replace form shell composition with `TemplateFormPage` and `TemplateFormSection`.
- [ ] Replace detail shell composition with `TemplateDetailPage` and `TemplateDetailSection`.
- [ ] Preserve existing API calls, validations, permissions, and route behavior.

### Task 3: Migrate Work-Order Pages

**Files:**
- Modify: `frontend/src/modules/work-order/pages/WorkOrderListPage.tsx`
- Modify: `frontend/src/modules/work-order/pages/WorkOrderFormPage.tsx`
- Modify: `frontend/src/modules/work-order/pages/WorkOrderDetailPage.tsx`

- [ ] Replace list shell composition with `TemplateListPage`.
- [ ] Replace form shell composition with `TemplateFormPage` and `TemplateFormSection`.
- [ ] Replace detail shell composition with `TemplateDetailPage` and `TemplateDetailSection`.
- [ ] Keep work-order-specific cell, status card, rich text, and history styles local.

### Task 4: Documentation and Verification

**Files:**
- Modify: `docs/page-integration-template.md`

- [ ] Update the page integration doc so future business modules start from the three template entries.
- [ ] Run frontend build.
- [ ] Start the local app and inspect user, role, and work-order list/form/detail pages.
