# Frontend Declutter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify dense Ledgerra frontend views by hiding secondary actions in contextual menus and panels while preserving existing workflows.

**Architecture:** Add a small reusable action-menu component, then apply it to the highest-density page areas. Use local state for collapsible panels and menu disclosure; do not add dependencies or change backend contracts.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Vite, existing CSS design tokens.

---

### Task 1: Shared Action Menu

**Files:**
- Create: `frontend/src/ui/ActionMenu.tsx`
- Modify: `frontend/src/ui/icons.tsx`
- Modify: `frontend/src/styles.css`
- Test through page tests that consume the menu.

**Steps:**
1. Add a reusable `ActionMenu` component that renders a compact trigger button and an absolutely positioned menu panel.
2. Support ordinary actions, disabled actions, danger actions, and arbitrary controls such as labels with selects.
3. Add a simple "more" icon to the local icon set.
4. Add CSS for `.action-menu`, `.action-menu-panel`, and related states.

### Task 2: Transactions Declutter

**Files:**
- Modify: `frontend/src/pages/TransactionsPage.tsx`
- Modify: `frontend/src/pages/TransactionsPage.test.tsx`
- Modify: `frontend/src/styles.css`

**Steps:**
1. Write tests that row edit/duplicate/delete actions are hidden until opening the row menu.
2. Write tests that bulk actions work after opening the bulk panel.
3. Write tests that export actions work after opening the export panel.
4. Implement menus/panels and keep existing action handlers unchanged.

### Task 3: Imports Declutter

**Files:**
- Modify: `frontend/src/pages/ImportsPage.tsx`
- Modify: `frontend/src/pages/ImportsPage.test.tsx`
- Modify: `frontend/src/styles.css`

**Steps:**
1. Write a test that review helper actions are unavailable until opening the review actions panel.
2. Implement a review actions disclosure panel that contains selection helpers, remember rules, duplicate toggle, and bulk category controls.

### Task 4: Categories Declutter

**Files:**
- Modify: `frontend/src/pages/CategoriesPage.tsx`
- Modify: `frontend/src/pages/CategoriesPage.test.tsx`
- Modify: `frontend/src/styles.css`

**Steps:**
1. Write tests that header utilities and row utilities are available through menus.
2. Implement header and row action menus while keeping "New category" visible.

### Task 5: Settings Declutter

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.test.tsx`
- Modify: `frontend/src/styles.css`

**Steps:**
1. Write tests that provider, rule, token, and FX row actions remain available through menus.
2. Replace repeated row buttons with `ActionMenu`.
3. Keep destructive danger-zone action buttons visible and explicit.

### Task 6: Verification

**Commands:**
- `npm test -- --run frontend/src/pages/TransactionsPage.test.tsx frontend/src/pages/ImportsPage.test.tsx frontend/src/pages/CategoriesPage.test.tsx frontend/src/pages/SettingsPage.test.tsx`
- `npm test`
- `npm run build`
- `graphify update .`

**Browser:**
- Start the dev stack if needed.
- Inspect transactions, imports, categories, and settings at desktop and narrow widths.
