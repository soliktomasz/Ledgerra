# Frontend audit — 2026-05-14

## Scope
- Reviewed all primary page components under `frontend/src/pages` and shared form components under `frontend/src/components`.
- Focused on control consistency, backend wiring expectations, and UX/accessibility issues that can block execution.

## Findings

### 1) Budget period toggle exposes a disabled button for a non-interactive state
- **Location:** `BudgetsPage` header period selector.
- **Issue:** A visually active control was implemented as a disabled `<button>`, which advertises interactivity but cannot be used.
- **Impact:** Inconsistent interaction semantics versus other page header controls; confusing keyboard/screen-reader behavior.
- **Action taken:** Replaced the disabled button with a semantic non-interactive `<span aria-current="true">` while preserving styling.
- **Status:** ✅ Fixed in this change.

### 2) Transactions filter chips intentionally block transfer toggling, but do not explain why
- **Location:** `TransactionsPage` filter chip rendering for `Transfer`.
- **Issue:** The transfer chip is disabled when rendered, but there is no inline explanation in the UI.
- **Impact:** Users can perceive this as a broken filter control.
- **Recommendation:** Add helper text or tooltip explaining transfer visibility is derived from linked entries and not toggleable independently.
- **Status:** ⚠️ Not changed in this patch (product copy/behavior decision).

### 3) Settings provider model fetch controls are gated by provider setup state
- **Location:** `SettingsPage` AI provider model controls.
- **Issue:** Controls are correctly disabled until provider keys/base URL are configured; this can be interpreted as "not working" without guidance.
- **Impact:** Potential support load when users expect model lists before configuration.
- **Recommendation:** Add inline hint next to disabled controls ("Configure API key first").
- **Status:** ⚠️ Not changed in this patch (copy-only enhancement).

## Backend wiring review notes
- Core mutations in major pages are already wired to API methods (`create/update/delete`, bulk transaction actions, import analyze/commit, budget updates).
- No obvious unbound primary CTA buttons were found in audited pages.

## Next suggested pass
1. Add explanatory microcopy for intentionally disabled controls (Transactions, Settings).
2. Run an accessibility check pass for keyboard/focus semantics across action bars.
3. Add regression tests for control semantics where state is presentational only.
