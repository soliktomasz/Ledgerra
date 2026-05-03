# Settings View Compact Layout Design

**Date:** 2026-05-03
**Issue:** LOW-5 — Improve settings view design
**Branch:** low-5-improve-settings-view-design

## Problem

The settings page renders 5 SectionCards in a single vertical stack at full content width (up to 1440px). This causes excessive scrolling and visually spread-out elements.

## Solution

Use the existing `split-grid` CSS class to pair smaller sections side-by-side in a two-column layout. The Import Rules section stays full-width since it contains an inline multi-field form and a data table that benefit from horizontal space.

## Layout

```
page-stack
├── PageHeader (full width)
├── split-grid (row 1)
│   ├── SectionCard: Appearance
│   └── SectionCard: Regional Preferences
├── split-grid (row 2)
│   ├── SectionCard: AI Providers
│   └── SectionCard: Current Session
└── SectionCard: Import Rules (full width)
```

## Changes required

### SettingsPage.tsx

Wrap pairs of SectionCards in `<div className="split-grid">` divs:

- Row 1: Appearance + Regional Preferences
- Row 2: AI Providers + Current Session
- Import Rules stays unwrapped (full width)

### CSS (styles.css)

No new CSS needed. The `split-grid` class already provides:

- `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; align-items: start;`
- Collapses to single column at 1180px breakpoint

## Responsive behavior

- **>1180px:** Two-column grid rows
- **<=1180px:** Falls back to single column (existing breakpoint)
- **<=620px:** Form internals collapse (existing behavior)

## What doesn't change

- All form logic, handlers, state management
- SectionCard component
- Import Rules section layout
- All existing responsive breakpoints
