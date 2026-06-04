# Graph Report - frontend  (2026-06-04)

## Corpus Check
- 74 files · ~56,623 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 564 nodes · 1186 edges · 38 communities (34 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f197cfe5`
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
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 40 edges
2. `useAuth()` - 31 edges
3. `formatCurrency()` - 24 edges
4. `useLedgerraData()` - 23 edges
5. `GoalsPage()` - 19 edges
6. `Account` - 16 edges
7. `apiClient` - 16 edges
8. `compilerOptions` - 15 edges
9. `Transaction` - 15 edges
10. `CategoriesPage()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `describeSpendingDelta()` --calls--> `formatCurrency()`  [EXTRACTED]
  src/pages/DashboardPage.tsx → src/utils/format.ts
- `waitForMonthlyReportAnalysisJob()` --calls--> `onJobUpdate`  [INFERRED]
  src/api/client.ts → src/api/client.test.ts
- `SettingsPage()` --calls--> `normalizeCurrencyCode()`  [EXTRACTED]
  src/pages/SettingsPage.tsx → src/utils/currency.ts
- `resolveInitialLanguageCode()` --calls--> `normalizeLanguageCode()`  [EXTRACTED]
  src/state/I18nContext.tsx → src/utils/language.ts
- `formatCurrency()` --calls--> `getLocaleForLanguageCode()`  [EXTRACTED]
  src/utils/format.ts → src/utils/language.ts

## Communities (38 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (34): AccountBalanceChart(), BalanceRange, RANGE_DAYS, AccountDetailColumn(), breadcrumbForType(), countInMonth(), formatMonthLabel(), formatSigned() (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (30): acknowledgementDefaults, ChecklistAction, ChecklistItem, DashboardInsight, dashboardWidgetDefaults, DashboardWidgetId, DashboardWidgetPreference, describeSpendingDelta() (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (29): apiClient, mocks, { result }, useLedgerraData(), useReportingOverview(), AccountsPage(), BudgetsPage(), CategoriesPage() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (23): buildDefaultValues(), now, toDateTimeLocal(), toFormType(), toLocalDateTimeInputValue(), TransactionForm(), TransactionFormMode, TransactionFormProps (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (21): DensityPreference, SettingsSection, clearButton, deleteButton, mocks, removeOpenAiButton, { rerender }, user (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (16): appendChild, click, createElement, element, mocks, originalCreateElement, removeChild, user (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (23): getDateKey(), getRelativeDayLabel(), de, defaultContextValue, es, I18nContext, I18nContextValue, I18nProvider() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (28): dependencies, react, react-dom, react-is, react-router-dom, recharts, devDependencies, jsdom (+20 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (19): categoryCopy, CategoryCopyKey, CategoryFilter, CategoryGroupId, CategoryIconKey, categoryIconOptions, CategoryKind, CategoryPreferences (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (21): BudgetEnvelope, BudgetFilter, BudgetGroupId, budgetKeywords, BudgetRhythmChart(), BudgetStatus, classifyBudgetCategory(), formatCompactCurrency() (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (23): AccountsIcon(), ArchiveIcon(), BasketIcon(), BoltIcon(), BriefcaseIcon(), BudgetsIcon(), CalendarIcon(), CategoriesIcon() (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (23): clamp(), formatDeadline(), formatDeadlineShort(), getDaysLeft(), getDeadlineDate(), getGoalStatus(), getGoalTheme(), getGoalTransactions() (+15 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (17): LedgerraDataOptions, mocks, user, AiProviderStatus, AiSettings, BackupAccount, BackupArchive, BackupCategory (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (10): AccountForm(), AccountFormProps, AccountFormValues, accountIconKinds, accountTypes, AccountFormModal(), AccountIconKind, PageHeader() (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, isolatedModules, jsx, lib, module, moduleResolution (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (15): AuthPersister, AuthResolver, fetchMonthlyReportAnalysisJob(), notifyUnauthorized(), readErrorMessage(), readMonthlyReportAnalysisResult(), refreshSession(), request() (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (11): buildPayload(), defaultValues, FormValues, parseAmount(), templateToValues(), toDateTimeLocal(), toUtcIso(), RecurringTransactionTemplatePayload (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (5): mocks, Transaction, MonthProvider(), MonthSelectionContext, MonthSelectionContextValue

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (8): customizationPanel, dashboardTree(), mocks, renderDashboardPage(), { rerender }, stored, user, DashboardSummary

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 20 - "Community 20"
Cohesion: 0.29
Nodes (6): analysisPromise, fetchMock, onUnauthorized, persist, refreshCalls, unsubscribe

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (6): link, mocks, overview, url, user, ReportingOverview

### Community 22 - "Community 22"
Cohesion: 0.40
Nodes (4): accounts, authPayload, categories, transactions

### Community 23 - "Community 23"
Cohesion: 0.40
Nodes (3): mocks, translations, user

### Community 24 - "Community 24"
Cohesion: 0.50
Nodes (3): authPayload, categories, transactions

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (3): APP_SHELL, requestUrl, responseClone

### Community 26 - "Community 26"
Cohesion: 0.50
Nodes (4): findSimilarCategoryPair(), getCategoryGroup(), getDefaultCategoryIcon(), normalizeSearchText()

## Knowledge Gaps
- **202 isolated node(s):** `composite`, `skipLibCheck`, `module`, `moduleResolution`, `allowSyntheticDefaultImports` (+197 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 16`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `Transaction` connect `Community 17` to `Community 0`, `Community 1`, `Community 3`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 15`, `Community 18`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 2` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 16`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `composite`, `skipLibCheck`, `module` to the rest of the system?**
  _202 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08282828282828283 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06039488966318235 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11538461538461539 - nodes in this community are weakly interconnected._