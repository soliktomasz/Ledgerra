# Frontend Declutter Design

## Context

The frontend audit found that Ledgerra's busiest screens keep secondary controls visible at all times. Transactions exposes row actions, bulk actions, filters, and exports together. Imports exposes selection helpers, duplicate toggles, rule actions, and category assignment in one toolbar. Categories shows header utilities and three icon actions on each row. Settings repeats small provider, rule, token, and danger-zone actions in dense lists.

## Direction

Keep primary actions visible and move secondary actions into contextual panels or menus:

- Primary actions remain one click away: add transaction, save drafts, create category, save settings.
- Secondary actions move behind "More", "Bulk actions", "Review actions", or row-level action menus.
- Existing behaviors, labels, disabled states, and accessible names remain available after opening the relevant panel.
- The implementation adds one small shared action-menu primitive instead of introducing a large UI framework.

## Screen Changes

Transactions:
- Replace always-visible row edit/duplicate/delete buttons with a row action menu.
- Collapse bulk category, move, and delete controls behind a "Bulk actions" panel while keeping selection summary visible.
- Move export/save-view controls behind an "Export and views" panel inside the filters sidebar.

Imports:
- Keep selected count visible.
- Move selection helpers, remember-rules, duplicate toggle, and bulk category assignment behind a "Review actions" panel.

Categories:
- Keep "New category" visible in the page header.
- Move export and suggestions into a header action menu.
- Replace row edit/duplicate/archive buttons with a row action menu.

Settings:
- Keep section navigation and form submit buttons visible.
- Move row-level remove/delete/revoke/toggle actions into compact row action menus.
- Leave danger-zone primary destructive buttons visible because hiding them can reduce the clarity of irreversible actions.

## Verification

- Update component tests to prove actions remain available through the new menus/panels.
- Run targeted page tests, full frontend tests, TypeScript/Vite build, and a local browser smoke check.
- Run `graphify update .` after code changes.
