# Settings Compact Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the settings page more compact by pairing sections side-by-side in a two-column grid layout.

**Architecture:** Wrap pairs of existing `SectionCard` components in `<div className="split-grid">` wrappers inside `SettingsPage.tsx`. The `split-grid` CSS class already exists and handles responsive collapse. Import Rules stays full-width.

**Tech Stack:** React, CSS (custom properties), Vitest + React Testing Library

---

### Task 1: Update SettingsPage layout to two-column grid

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx:176-410` (JSX return block)

**Step 1: Wrap Appearance + Regional Preferences in split-grid**

In `SettingsPage.tsx`, find the return statement (line 176). After the `<PageHeader>` component, wrap the first two `<SectionCard>` components (Appearance and Regional Preferences) in a `<div className="split-grid">`:

```tsx
<div className="split-grid">
  <SectionCard title={t("settings.appearance")}>
    {/* existing Appearance content unchanged */}
  </SectionCard>

  <SectionCard title={t("settings.regionalPreferences")}>
    {/* existing Regional Preferences content unchanged */}
  </SectionCard>
</div>
```

**Step 2: Wrap AI Providers + Current Session in split-grid**

Wrap the AI Providers `<SectionCard>` and Current Session `<SectionCard>` in a second `<div className="split-grid">`:

```tsx
<div className="split-grid">
  <SectionCard title={t("settings.aiProviders")}>
    {/* existing AI Providers content unchanged */}
  </SectionCard>

  <SectionCard title={t("settings.currentSession")}>
    {/* existing Current Session content unchanged */}
  </SectionCard>
</div>
```

**Step 3: Leave Import Rules unwrapped**

The Import Rules `<SectionCard>` stays as-is (no wrapper div), keeping it full-width.

Final structure of the return block:
```tsx
<div className="page-stack">
  <PageHeader ... />
  <div className="split-grid">
    <SectionCard title="Appearance">...</SectionCard>
    <SectionCard title="Regional Preferences">...</SectionCard>
  </div>
  <div className="split-grid">
    <SectionCard title="AI Providers">...</SectionCard>
    <SectionCard title="Current Session">...</SectionCard>
  </div>
  <SectionCard title="Import Rules">...</SectionCard>
</div>
```

**Step 4: Run existing tests**

Run: `cd frontend && npx vitest run src/pages/SettingsPage.test.tsx`
Expected: All 9 tests PASS (tests query by text/role, not DOM structure)

**Step 5: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Visual verification**

Start dev server and verify in browser:
- Desktop (>1180px): sections appear in two-column pairs
- Narrow window (<=1180px): falls back to single column
- Mobile (<=620px): form internals collapse

**Step 7: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "Use two-column grid layout for settings page (LOW-5)"
```
