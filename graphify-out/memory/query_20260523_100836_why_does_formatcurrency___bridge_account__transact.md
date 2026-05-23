---
type: "query"
date: "2026-05-23T10:08:36.220141+00:00"
question: "Why does formatCurrency() bridge account, transaction, budget, goal, dashboard, and chart areas?"
contributor: "graphify"
source_nodes: ["formatCurrency()", "getLocaleForLanguageCode()", "AccountDetailColumn()", "TransactionsPage()", "BudgetsPage()", "GoalsPage()", "ReportsPage()"]
---

# Q: Why does formatCurrency() bridge account, transaction, budget, goal, dashboard, and chart areas?

## Answer

formatCurrency() is a frontend presentation utility in frontend/src/utils/format.ts at L9. The graph shows extracted imports and calls from account components, transaction pages, budget pages, goal pages, reports, charts, and dashboard helpers. It bridges those communities because they all render money values and reuse the same localization-aware formatting path, including getLocaleForLanguageCode().

## Source Nodes

- formatCurrency()
- getLocaleForLanguageCode()
- AccountDetailColumn()
- TransactionsPage()
- BudgetsPage()
- GoalsPage()
- ReportsPage()