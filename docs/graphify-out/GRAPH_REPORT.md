# Graph Report - docs  (2026-05-24)

## Corpus Check
- 4 files · ~6,905 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 128 nodes · 124 edges · 12 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9938297e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `Accounts page redesign — design` - 13 edges
2. `UI architecture` - 9 edges
3. `Accounts page redesign — Implementation Plan` - 9 edges
4. `Phase 1 — Backend domain & schema` - 7 edges
5. `Task 4: Extend `AccountDetails`, commands, and `IAccountStore` for new fields` - 7 edges
6. `Phase 4 — Frontend components` - 6 edges
7. `Task 1: Update SettingsPage layout to two-column grid` - 5 edges
8. `Task 19: Add translations (pl + en)` - 5 edges
9. `Frontend audit — 2026-05-14` - 5 edges
10. `Data model` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (12 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (18): code:csharp (namespace Ledgerra.Domain.Accounts;), code:csharp (public static AccountDetails MapAccount(Account account)), code:csharp (InstitutionName = command.InstitutionName,), code:bash (git add backend/src/Ledgerra.Application/Accounts/AccountUse), code:csharp (public sealed class CreateAccountRequest), code:csharp (private static AccountResponse MapAccount(AccountDetails acc), code:bash (git add backend/src/Ledgerra.Api/Contracts/AccountContracts.), code:bash (git add backend/tests/Ledgerra.Api.Tests/) (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (16): code:ts (export type AccountFormValues = {), code:bash (git add frontend/src/components/AccountForm.tsx), code:tsx (export function AccountFormModal({), code:bash (git add frontend/src/components/AccountFormModal.tsx), code:tsx (import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxi), code:bash (git add frontend/src/components/AccountBalanceChart.tsx), code:tsx (export function AccountListColumn({), code:bash (git add frontend/src/components/AccountListColumn.tsx fronte) (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (13): Accounts page redesign — design, API, File-touch summary, Goal, In scope, Interactions, Manual verification, Open questions / deferred (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (11): Accounts page redesign — Implementation Plan, code:ts (export type AccountIconKind = "Bank" | "Piggy" | "Card" | "C), code:ts (createAccount(token: string, payload: Pick<Account,), code:bash (git add frontend/src/types.ts frontend/src/api/client.ts), code:bash (git add frontend/src/pages/AccountsPage.test.tsx), Done criteria, Phase 2 — Frontend types & API, Phase 7 — Final verification (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (10): Balance over time chart, code:text (AccountsPage), Component tree, Grouping, KPI cards, Mobile (≤900px), Recent operations, Route (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (10): code:tsx (export function AccountsPage() {), code:bash (git add frontend/src/pages/AccountsPage.tsx), code:tsx (<Route path="/accounts" element={<AccountsPage />} />), code:bash (git add frontend/src/App.tsx), code:ts (const formParam = initialQuery.get("form");), code:bash (git add frontend/src/pages/TransactionsPage.tsx), Phase 5 — Page rewrite & routing, Task 15: Rewrite `AccountsPage.tsx` (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (8): 1) Budget period toggle exposes a disabled button for a non-interactive state, 2) Transactions filter chips intentionally block transfer toggling, but do not explain why, 3) Settings provider model fetch controls are gated by provider setup state, Backend wiring review notes, Findings, Frontend audit — 2026-05-14, Next suggested pass, Scope

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (9): code:ts (import { describe, expect, it } from "vitest";), code:ts (import type { Account } from "../types";), code:bash (git add frontend/src/utils/accounts.ts frontend/src/utils/ac), code:ts (import { computeBalanceSeries } from "./accounts";), code:ts (import type { Transaction } from "../types";), code:bash (git add frontend/src/utils/accounts.ts frontend/src/utils/ac), Phase 3 — Frontend utilities (TDD), Task 8: `groupAccountsByType` utility (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (8): Backend — `Account` (additive), code:csharp (public sealed class Account), code:csharp (builder.Property(a => a.InstitutionName).HasMaxLength(120);), code:sql (ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "Institution), code:ts (export type AccountIconKind = "Bank" | "Piggy" | "Card" | "C), Data model, Frontend `Account` type, Schema migration (Postgres)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (8): code:bash (git add frontend/src/styles.css), code:json ("accounts.netWorth": "Net worth",), code:json ("accounts.netWorth": "Wartość netto",), code:bash (npm --prefix frontend run build), code:bash (git add frontend/src/state/I18nContext.tsx), Phase 6 — Styles, i18n, polish, Task 18: Add CSS for the redesign, Task 19: Add translations (pl + en)

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (6): code:tsx (<div className="split-grid">), code:tsx (<div className="split-grid">), code:tsx (<div className="page-stack">), code:bash (git add frontend/src/pages/SettingsPage.tsx), Settings Compact Layout Implementation Plan, Task 1: Update SettingsPage layout to two-column grid

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (4): code:csharp (public string? InstitutionName { get; set; }), code:csharp (builder.Property(account => account.InstitutionName).HasMaxL), code:bash (git add backend/src/Ledgerra.Domain/Accounts/Account.cs back), Task 2: Add new fields to `Account` entity + EF mapping

## Knowledge Gaps
- **81 isolated node(s):** `code:tsx (<div className="split-grid">)`, `code:tsx (<div className="split-grid">)`, `code:tsx (<div className="page-stack">)`, `code:bash (git add frontend/src/pages/SettingsPage.tsx)`, `Goal` (+76 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Accounts page redesign — Implementation Plan` connect `Community 3` to `Community 0`, `Community 1`, `Community 5`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.317) - this node is a cross-community bridge._
- **Why does `Phase 1 — Backend domain & schema` connect `Community 0` to `Community 11`, `Community 3`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Why does `Phase 4 — Frontend components` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **What connects `code:tsx (<div className="split-grid">)`, `code:tsx (<div className="split-grid">)`, `code:tsx (<div className="page-stack">)` to the rest of the system?**
  _81 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._