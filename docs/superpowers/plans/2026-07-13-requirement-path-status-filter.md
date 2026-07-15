# Requirement Path Status Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make requirement status query options follow the selected requirement path and clear incompatible selections.

**Architecture:** Extend the existing requirement status module with two pure helpers: one returns valid statuses for a path, and one preserves or clears a selected status. The requirement list page consumes these helpers while continuing to use the existing filter components and API parameters.

**Tech Stack:** React 18, TypeScript, Ant Design admin components, Node.js test runner.

## Global Constraints

- Only modify PMIS.
- Reuse existing requirement status labels, list template, filter components, and API.
- Do not add dependencies, backend endpoints, or database changes.
- Unselected paths expose all statuses; selected paths expose path-specific and shared delivery statuses including pause.

---

### Task 1: Requirement path and status query linkage

**Files:**
- Modify: `frontend/src/modules/requirement/statusTransitions.ts`
- Modify: `frontend/src/modules/requirement/pages/RequirementListPage.tsx`
- Test: `frontend/test/requirementStatusTransitions.test.mjs`

**Interfaces:**
- Consumes: `RequirementType`, `RequirementStatus`, `requirementStatusLabels`.
- Produces: `requirementStatusesForType(type?: RequirementType): RequirementStatus[]` and `normalizeRequirementStatusForType(type: RequirementType | undefined, status: RequirementStatus | undefined): RequirementStatus | undefined`.

- [ ] **Step 1: Write the failing test**

Add source-contract assertions that require the status module to export both helpers, require all four paths to include status `35`, and require the list page to derive status options and normalize the selected status when the path changes.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/requirementStatusTransitions.test.mjs`

Expected: FAIL because `requirementStatusesForType` and `normalizeRequirementStatusForType` do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement the two pure helpers using the existing `pathStatuses` map plus shared status `35`. In `RequirementListPage`, import the helpers, derive status options from the draft requirement path, and update the path `onChange` to normalize the draft status.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
cd frontend
node --test test/requirementStatusTransitions.test.mjs
node --test test/*.test.mjs
npm run audit:components:strict
npm run audit:api-contracts
npm run build
cd ..
node scripts/verify-change.mjs
```

Expected: all tests and audits pass with zero blockers; build succeeds.

- [ ] **Step 5: Browser acceptance**

Open `/requirements`, verify all statuses before selecting a path, verify path-specific options after selection, verify an incompatible status clears when changing path, submit the query, and confirm results load successfully.
