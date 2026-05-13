import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import { useMonthSelection } from "../state/MonthContext";
import type { BudgetCategory, Category, Transaction } from "../types";
import { BookmarkIcon, BudgetsIcon, CategoryIcon, DuplicateIcon, EditIcon, TrendIcon } from "../ui/icons";
import { formatCurrency } from "../utils/format";

type BudgetStatus = "ok" | "near" | "over" | "unset";
type BudgetFilter = "all" | "ok" | "near" | "over";
type BudgetGroupId = "fixed" | "daily" | "flexible";

type BudgetEnvelope = {
  categoryId: string;
  categoryName: string;
  color: string;
  groupId: BudgetGroupId;
  planned: number;
  spent: number;
  remaining: number;
  operationCount: number;
  ratio: number;
  status: BudgetStatus;
};

const rowPalette = ["#34d9a8", "#c084fc", "#93c5fd", "#f9a8d4", "#fbbf24", "#fb9f7b"];
const fixedKeywords = ["rent", "mortgage", "housing", "home", "utilities", "utility", "bill", "bills", "subscription", "insurance", "internet", "phone", "czynsz", "mieszkanie", "rachunki", "subskrypcje", "prad", "prąd", "woda", "abonament"];
const dailyKeywords = ["groceries", "grocery", "food", "dining", "restaurant", "transport", "fuel", "shopping", "health", "pharmacy", "jedzenie", "spozywcze", "spożywcze", "restauracje", "transport", "zakupy", "apteka"];

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseDraftAmount(value: string | undefined, fallback = 0) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMonthDate(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getBudgetTiming(year: number, month: number) {
  const now = new Date();
  const daysInMonth = getDaysInMonth(year, month);
  const selectedIndex = year * 12 + month;
  const currentIndex = now.getFullYear() * 12 + now.getMonth() + 1;
  const isCurrentMonth = selectedIndex === currentIndex;
  const isPastMonth = selectedIndex < currentIndex;
  const elapsedDays = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : isPastMonth ? daysInMonth : 0;

  return {
    daysInMonth,
    elapsedDays,
    daysRemaining: Math.max(daysInMonth - elapsedDays, 0),
    monthProgress: daysInMonth > 0 ? elapsedDays / daysInMonth : 0,
    isFutureMonth: selectedIndex > currentIndex
  };
}

function getLocale(languageCode: string) {
  if (languageCode.startsWith("pl")) return "pl-PL";
  if (languageCode.startsWith("de")) return "de-DE";
  if (languageCode.startsWith("es")) return "es-ES";
  return "en-US";
}

function formatMonthLabel(date: Date, languageCode: string) {
  return new Intl.DateTimeFormat(getLocale(languageCode), { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatCompactCurrency(value: number, currencyCode: string, languageCode: string) {
  return new Intl.NumberFormat(getLocale(languageCode), {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function getBudgetCopy(languageCode: string) {
  const polish = languageCode.startsWith("pl");

  return {
    plan: polish ? "Plan" : "Plan",
    searchLabel: polish ? "Szukaj kategorii budżetu" : "Search budget categories",
    searchPlaceholder: polish ? "Szukaj w budżecie..." : "Search budget...",
    month: polish ? "Miesiąc" : "Month",
    quarter: polish ? "Kwartał" : "Quarter",
    year: polish ? "Rok" : "Year",
    periodView: polish ? "Widok okresu" : "Period view",
    copyPrevious: polish ? "Skopiuj z poprzedniego" : "Copy previous",
    copying: polish ? "Kopiowanie..." : "Copying...",
    template: polish ? "Szablon 50/30/20" : "50/30/20 template",
    totalBudget: polish ? "Budżet ogółem" : "Total budget",
    spentAlready: polish ? "Już wydane" : "Already spent",
    remaining: polish ? "Pozostało" : "Remaining",
    dailyLimit: polish ? "Dzienny limit" : "Daily limit",
    daysLeft: (count: number) => polish ? `${count} ${count === 1 ? "dzień" : "dni"} do końca` : `${count} ${count === 1 ? "day" : "days"} left`,
    categoriesStatic: polish ? "kategorii" : "categories",
    categoriesMutable: polish ? "edytowalnych" : "editable",
    ofBudget: polish ? "budżetu" : "of budget",
    pace: polish ? "tempo" : "pace",
    toKeepPlan: polish ? "aby trzymać plan" : "to keep the plan",
    dayProgress: (day: number, days: number, percent: number) =>
      polish ? `Jesteś w ${day}. dniu z ${days} - to ${percent}% miesiąca.` : `You are on day ${day} of ${days} - ${percent}% of the month.`,
    futureMonth: polish ? "Ten miesiąc jeszcze się nie rozpoczął." : "This month has not started yet.",
    envelopes: polish ? "Koperty kategorii" : "Category envelopes",
    editInline: polish ? "edytuj limity inline" : "edit limits inline",
    all: polish ? "Wszystkie" : "All",
    ok: polish ? "W normie" : "On track",
    attention: polish ? "Uwaga" : "Attention",
    over: polish ? "Przekroczono" : "Over",
    addCategory: polish ? "Kategoria" : "Category",
    fixed: polish ? "Stałe zobowiązania" : "Fixed commitments",
    fixedDescription: polish ? "Czynsz, rachunki, subskrypcje" : "Rent, bills, subscriptions",
    daily: polish ? "Codzienne życie" : "Everyday life",
    dailyDescription: polish ? "Jedzenie, transport, zakupy" : "Food, transport, shopping",
    flexible: polish ? "Elastyczne wydatki" : "Flexible spending",
    flexibleDescription: polish ? "Pozostałe limity miesiąca" : "Everything else in the month",
    operation: (count: number) => polish ? `${count} ${count === 1 ? "operacja" : "operacji"}` : `${count} ${count === 1 ? "operation" : "operations"}`,
    noOperations: polish ? "brak operacji" : "no operations",
    noLimit: polish ? "Bez limitu" : "No limit",
    nearLimit: polish ? "Blisko limitu" : "Near limit",
    monthlyLimit: polish ? "Limit miesięczny" : "Monthly limit",
    remainingAmount: polish ? "Pozostało" : "Left",
    overBy: polish ? "Ponad limit" : "Over by",
    rhythm: polish ? "Rytm miesiąca" : "Month rhythm",
    cumulative: polish ? "narastająco" : "cumulative",
    actualSpending: polish ? "Faktyczne wydatki" : "Actual spending",
    forecast: polish ? "Prognoza" : "Forecast",
    idealPace: polish ? "Idealne tempo" : "Ideal pace",
    today: polish ? "dziś" : "today",
    limit: polish ? "Limit" : "Limit",
    projection: polish ? "Prognoza na koniec miesiąca" : "End-of-month forecast",
    vsLimit: polish ? "vs limit" : "vs limit",
    currentPaceOver: (daily: string) => polish ? `Przy obecnym tempie zmiennych wydatków (${daily}/dzień) plan zostanie przekroczony.` : `At the current variable spending pace (${daily}/day), the plan will be exceeded.`,
    currentPaceOk: (daily: string) => polish ? `Przy obecnym tempie wydatków (${daily}/dzień) plan zostaje w limicie.` : `At the current spending pace (${daily}/day), the plan stays inside the limit.`,
    projectionTipOver: (category: string, amount: string) => polish ? `Aby zmieścić się w planie, ogranicz ${category} do około ${amount} dziennie.` : `To fit the plan, keep ${category} near ${amount} per day.`,
    projectionTipOk: (amount: string) => polish ? `Masz jeszcze około ${amount} dziennie na pozostałą część miesiąca.` : `You still have about ${amount} per day for the rest of the month.`,
    recurring: polish ? "Cykliczne" : "Recurring",
    manage: polish ? "Zarządzaj" : "Manage",
    emptyTitle: polish ? "Brak kategorii w tym widoku" : "No categories in this view",
    emptyBody: polish ? "Zmień filtr albo dodaj limit dla kolejnej kategorii." : "Adjust the filter or add another category limit."
  };
}

function classifyBudgetCategory(categoryName: string): BudgetGroupId {
  const normalized = normalizeSearchText(categoryName);

  if (fixedKeywords.some((keyword) => normalized.includes(normalizeSearchText(keyword)))) {
    return "fixed";
  }

  if (dailyKeywords.some((keyword) => normalized.includes(normalizeSearchText(keyword)))) {
    return "daily";
  }

  return "flexible";
}

function getBudgetStatus(planned: number, spent: number): BudgetStatus {
  if (planned <= 0) return "unset";
  if (spent > planned) return "over";
  if (spent / planned >= 0.9) return "near";
  return "ok";
}

function buildBudgetRows(
  expenseCategories: Category[],
  budgetCategories: BudgetCategory[],
  draft: Map<string, string>,
  transactions: Transaction[],
  selectedMonth: string
): BudgetEnvelope[] {
  const budgetByCategory = new Map(budgetCategories.map((category) => [category.categoryId, category]));
  const monthlyExpenseTransactions = transactions.filter((transaction) => transaction.type === "Expense" && transaction.occurredOnUtc.slice(0, 7) === selectedMonth);

  return expenseCategories.map((category, index) => {
    const budgetCategory = budgetByCategory.get(category.id);
    const fallbackPlanned = budgetCategory?.planned ?? 0;
    const planned = Math.max(parseDraftAmount(draft.get(category.id), fallbackPlanned), 0);
    const spent = Math.max(budgetCategory?.spent ?? 0, 0);
    const operationCount = monthlyExpenseTransactions.filter((transaction) => transaction.categoryId === category.id).length;
    const remaining = planned - spent;
    const ratio = planned > 0 ? spent / planned : 0;

    return {
      categoryId: category.id,
      categoryName: category.name,
      color: category.color ?? rowPalette[index % rowPalette.length],
      groupId: classifyBudgetCategory(category.name),
      planned,
      spent,
      remaining,
      operationCount,
      ratio,
      status: getBudgetStatus(planned, spent)
    };
  });
}

function buildTemplateDraft(rows: BudgetEnvelope[], baseline: number, draft: Map<string, string>) {
  const next = new Map(draft);
  const allocationByGroup: Record<BudgetGroupId, number> = {
    fixed: 0.5,
    daily: 0.3,
    flexible: 0.2
  };

  (Object.keys(allocationByGroup) as BudgetGroupId[]).forEach((groupId) => {
    const groupRows = rows.filter((row) => row.groupId === groupId);
    if (groupRows.length === 0) {
      return;
    }

    const groupWeight = groupRows.reduce((sum, row) => sum + Math.max(row.planned, row.spent, 1), 0);
    const groupBudget = baseline * allocationByGroup[groupId];
    groupRows.forEach((row) => {
      const rowWeight = Math.max(row.planned, row.spent, 1);
      next.set(row.categoryId, (groupBudget * rowWeight / groupWeight).toFixed(2));
    });
  });

  return next;
}

function pointsToString(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function BudgetRhythmChart({
  totalPlanned,
  totalSpent,
  projectedEnd,
  transactions,
  selectedMonth,
  timing,
  currencyCode,
  languageCode,
  copy
}: {
  totalPlanned: number;
  totalSpent: number;
  projectedEnd: number;
  transactions: Transaction[];
  selectedMonth: string;
  timing: ReturnType<typeof getBudgetTiming>;
  currencyCode: string;
  languageCode: string;
  copy: ReturnType<typeof getBudgetCopy>;
}) {
  const width = 520;
  const height = 218;
  const padding = { top: 14, right: 18, bottom: 32, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const monthlyExpenseTransactions = transactions.filter((transaction) => transaction.type === "Expense" && transaction.occurredOnUtc.slice(0, 7) === selectedMonth);
  const maxValue = Math.max(totalPlanned, totalSpent, projectedEnd, 1000) * 1.12;
  const elapsedDay = Math.max(timing.elapsedDays, 1);
  const xForDay = (day: number) => padding.left + ((day - 1) / Math.max(timing.daysInMonth - 1, 1)) * plotWidth;
  const yForValue = (value: number) => padding.top + plotHeight - (Math.max(value, 0) / maxValue) * plotHeight;
  const dailyAmounts = Array.from({ length: timing.daysInMonth }, () => 0);

  monthlyExpenseTransactions.forEach((transaction) => {
    const transactionDay = new Date(transaction.occurredOnUtc).getDate();
    if (transactionDay >= 1 && transactionDay <= timing.daysInMonth) {
      dailyAmounts[transactionDay - 1] += Math.abs(transaction.amount);
    }
  });

  const actualByDay: Array<{ day: number; value: number }> = [];
  let runningTotal = 0;
  for (let day = 1; day <= elapsedDay; day += 1) {
    runningTotal += dailyAmounts[day - 1] ?? 0;
    actualByDay.push({ day, value: runningTotal });
  }

  const actualSeries = monthlyExpenseTransactions.length > 0
    ? actualByDay
    : [
        { day: 1, value: totalSpent * 0.72 },
        { day: Math.max(1, Math.round(elapsedDay / 2)), value: totalSpent * 0.84 },
        { day: elapsedDay, value: totalSpent }
      ];
  const dedupedActualSeries = actualSeries.filter((point, index, series) => index === 0 || point.day !== series[index - 1].day || point.value !== series[index - 1].value);
  const actualPoints = dedupedActualSeries.map((point) => ({ x: xForDay(point.day), y: yForValue(point.value) }));
  const lastActual = dedupedActualSeries[dedupedActualSeries.length - 1] ?? { day: elapsedDay, value: totalSpent };
  const forecastPoints = [
    { x: xForDay(lastActual.day), y: yForValue(lastActual.value) },
    { x: xForDay(timing.daysInMonth), y: yForValue(projectedEnd) }
  ];
  const idealPoints = [
    { x: xForDay(1), y: yForValue(0) },
    { x: xForDay(timing.daysInMonth), y: yForValue(totalPlanned) }
  ];
  const areaPoints = [
    ...actualPoints,
    { x: xForDay(lastActual.day), y: yForValue(0) },
    { x: xForDay(1), y: yForValue(0) }
  ];
  const gridValues = [0, maxValue / 2, maxValue];

  return (
    <div className="budget-rhythm-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.rhythm}>
        <defs>
          <linearGradient id="budgetRhythmFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridValues.map((value) => (
          <g key={value}>
            <line className="budget-chart-grid" x1={padding.left} x2={width - padding.right} y1={yForValue(value)} y2={yForValue(value)} />
            <text className="budget-chart-axis" x={padding.left - 10} y={yForValue(value) + 4} textAnchor="end">
              {formatCompactCurrency(value, currencyCode, languageCode)}
            </text>
          </g>
        ))}
        <line className="budget-chart-today-line" x1={xForDay(elapsedDay)} x2={xForDay(elapsedDay)} y1={padding.top} y2={height - padding.bottom} />
        <polygon className="budget-chart-area" points={pointsToString(areaPoints)} />
        <polyline className="budget-chart-ideal" points={pointsToString(idealPoints)} />
        <polyline className="budget-chart-forecast" points={pointsToString(forecastPoints)} />
        <polyline className="budget-chart-actual" points={pointsToString(actualPoints)} />
        <circle className="budget-chart-marker" cx={xForDay(lastActual.day)} cy={yForValue(lastActual.value)} r="5.5" />
        <text className="budget-chart-limit-label" x={xForDay(Math.max(2, timing.daysInMonth - 8))} y={yForValue(totalPlanned) - 8}>
          {copy.limit} · {formatCompactCurrency(totalPlanned, currencyCode, languageCode)}
        </text>
        {[1, elapsedDay, Math.ceil(timing.daysInMonth / 2), timing.daysInMonth].map((day, index) => (
          <text key={`${day}-${index}`} className="budget-chart-axis" x={xForDay(day)} y={height - 12} textAnchor={index === 0 ? "start" : index === 3 ? "end" : "middle"}>
            {day === elapsedDay ? `${copy.today} · ${day}` : day}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function BudgetsPage() {
  const { auth } = useAuth();
  const { languageCode, t } = useI18n();
  const { selectedMonth, selectedYear, selectedMonthNumber } = useMonthSelection();
  const { categories, budget, profile, transactions = [], refresh } = useLedgerraData({
    categories: true,
    budget: true,
    profile: true,
    transactions: true
  });
  const copy = getBudgetCopy(languageCode);
  const mainCurrencyCode = profile?.preferredCurrencyCode ?? "USD";
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "Expense"),
    [categories]
  );

  const initialValues = useMemo(() => {
    const values = new Map<string, string>();
    budget?.categories.forEach((category) => values.set(category.categoryId, String(category.planned)));
    return values;
  }, [budget]);

  const [draft, setDraft] = useState<Map<string, string>>(initialValues);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BudgetFilter>("all");
  const [periodView, setPeriodView] = useState<"month" | "quarter" | "year">("month");
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    setDraft(initialValues);
  }, [initialValues]);

  const budgetRows = useMemo(
    () => buildBudgetRows(expenseCategories, budget?.categories ?? [], draft, transactions, selectedMonth),
    [budget?.categories, draft, expenseCategories, selectedMonth, transactions]
  );
  const timing = useMemo(() => getBudgetTiming(selectedYear, selectedMonthNumber), [selectedMonthNumber, selectedYear]);
  const monthLabel = formatMonthLabel(getMonthDate(selectedYear, selectedMonthNumber), languageCode);
  const totalPlanned = budgetRows.reduce((sum, row) => sum + row.planned, 0);
  const totalSpent = budgetRows.reduce((sum, row) => sum + row.spent, 0);
  const totalRemaining = totalPlanned - totalSpent;
  const spentRatio = totalPlanned > 0 ? totalSpent / totalPlanned : 0;
  const monthProgressPercent = Math.round(timing.monthProgress * 100);
  const budgetProgressPercent = Math.round(Math.min(spentRatio, 1) * 100);
  const dailyLimit = timing.daysRemaining > 0 ? Math.max(totalRemaining, 0) / timing.daysRemaining : Math.max(totalRemaining, 0);
  const dailyAverage = timing.elapsedDays > 0 ? totalSpent / timing.elapsedDays : 0;
  const projectedEnd = timing.elapsedDays > 0 ? dailyAverage * timing.daysInMonth : totalSpent;
  const projectionDelta = projectedEnd - totalPlanned;
  const pressureCategory = [...budgetRows]
    .filter((row) => row.planned > 0)
    .sort((first, second) => second.ratio - first.ratio)[0];
  const normalizedQuery = normalizeSearchText(query.trim());
  const visibleRows = budgetRows.filter((row) => {
    const matchesQuery = normalizedQuery.length === 0 || normalizeSearchText(row.categoryName).includes(normalizedQuery);
    const matchesFilter = filter === "all" || row.status === filter || (filter === "near" && row.status === "near");
    return matchesQuery && matchesFilter;
  });
  const groupedRows = [
    { id: "fixed" as const, label: copy.fixed, description: copy.fixedDescription, rows: visibleRows.filter((row) => row.groupId === "fixed") },
    { id: "daily" as const, label: copy.daily, description: copy.dailyDescription, rows: visibleRows.filter((row) => row.groupId === "daily") },
    { id: "flexible" as const, label: copy.flexible, description: copy.flexibleDescription, rows: visibleRows.filter((row) => row.groupId === "flexible") }
  ].filter((group) => group.rows.length > 0);
  const statusCounts = budgetRows.reduce<Record<BudgetStatus, number>>(
    (counts, row) => ({ ...counts, [row.status]: counts[row.status] + 1 }),
    { ok: 0, near: 0, over: 0, unset: 0 }
  );
  const recurringRows = budgetRows
    .filter((row) => row.groupId === "fixed" && row.planned > 0)
    .sort((first, second) => second.planned - first.planned)
    .slice(0, 3);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    const payload = expenseCategories
      .map((category) => ({
        categoryId: category.id,
        plannedAmount: parseDraftAmount(draft.get(category.id), 0)
      }))
      .filter((item) => item.plannedAmount > 0);

    await apiClient.updateBudget(auth.accessToken, selectedYear, selectedMonthNumber, payload);
    await refresh();
  };

  const handleCopyPreviousMonth = async () => {
    if (!auth?.accessToken) {
      return;
    }

    const previousMonthDate = new Date(Date.UTC(selectedYear, selectedMonthNumber - 2, 1));
    setIsCopying(true);

    try {
      const previousBudget = await apiClient.getBudget(auth.accessToken, previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth() + 1);
      const next = new Map(draft);
      previousBudget.categories.forEach((category) => {
        next.set(category.categoryId, String(category.planned));
      });
      setDraft(next);
    } finally {
      setIsCopying(false);
    }
  };

  const handleApplyTemplate = () => {
    if (budgetRows.length === 0) {
      return;
    }

    setDraft(buildTemplateDraft(budgetRows, Math.max(totalPlanned, totalSpent, 1000), draft));
  };

  return (
    <form className="budget-plan-page" onSubmit={handleSubmit}>
      <div className="budget-page-topbar">
        <div className="budget-breadcrumb" aria-label="Breadcrumb">
          <span>Ledgerra</span>
          <span>/</span>
          <span>{copy.plan}</span>
          <span>/</span>
          <strong>{t("nav.budgets")} · {monthLabel}</strong>
        </div>
        <label className="budget-search">
          <span className="sr-only">{copy.searchLabel}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
        </label>
      </div>

      <section className="budget-hero">
        <div className="budget-hero-copy">
          <span className="eyebrow">{t("budgets.eyebrow")}</span>
          <h1>{t("budgets.title")}</h1>
          <p>
            {t("budgets.description")}
            <strong>{timing.isFutureMonth ? copy.futureMonth : copy.dayProgress(timing.elapsedDays, timing.daysInMonth, monthProgressPercent)}</strong>
          </p>
        </div>

        <div className="budget-hero-actions">
          <div className="budget-period-toggle" role="group" aria-label={copy.periodView}>
            <button className={periodView === "month" ? "active" : ""} type="button" onClick={() => setPeriodView("month")}>{copy.month}</button>
            <button className={periodView === "quarter" ? "active" : ""} type="button" onClick={() => setPeriodView("quarter")}>{copy.quarter}</button>
            <button className={periodView === "year" ? "active" : ""} type="button" onClick={() => setPeriodView("year")}>{copy.year}</button>
          </div>
          <button className="budget-secondary-action" type="button" onClick={handleCopyPreviousMonth} disabled={isCopying}>
            <DuplicateIcon />
            {isCopying ? copy.copying : copy.copyPrevious}
          </button>
          <button className="budget-secondary-action" type="button" onClick={handleApplyTemplate}>
            <BookmarkIcon />
            {copy.template}
          </button>
          <button className="budget-primary-action" type="submit">
            <span aria-hidden="true">✓</span>
            {t("budgets.saveBudget")}
          </button>
        </div>
      </section>

      <section className="budget-summary-grid" aria-label={t("budgets.progress")}>
        <article className="budget-summary-card">
          <span>{copy.totalBudget}</span>
          <strong>{formatCurrency(totalPlanned, mainCurrencyCode)}</strong>
          <p>{budgetRows.length} {copy.categoriesStatic} · {budgetRows.filter((row) => row.planned > 0).length} {copy.categoriesMutable}</p>
        </article>
        <article className="budget-summary-card">
          <span>{copy.spentAlready}</span>
          <strong>{formatCurrency(totalSpent, mainCurrencyCode)}</strong>
          <div className="budget-summary-progress" aria-hidden="true">
            <div style={{ width: `${budgetProgressPercent}%` }} />
          </div>
          <p><b>{budgetProgressPercent}%</b> {copy.ofBudget} · {copy.pace} {monthProgressPercent}%</p>
        </article>
        <article className={totalRemaining < 0 ? "budget-summary-card is-negative" : "budget-summary-card is-positive"}>
          <span>{copy.remaining}</span>
          <strong>{formatCurrency(totalRemaining, mainCurrencyCode)}</strong>
          <p>{copy.daysLeft(timing.daysRemaining)}</p>
        </article>
        <article className="budget-summary-card">
          <span>{copy.dailyLimit}</span>
          <strong>{formatCurrency(dailyLimit, mainCurrencyCode)}</strong>
          <p>{copy.toKeepPlan}</p>
        </article>
      </section>

      <div className="budget-workspace-grid">
        <section className="budget-envelope-panel">
          <div className="budget-panel-heading">
            <div>
              <h2>{copy.envelopes}</h2>
              <p>{copy.editInline}</p>
            </div>
            <div className="budget-envelope-tools">
              <div className="budget-filter-tabs" role="group" aria-label={copy.envelopes}>
                {[
                  { id: "all" as const, label: copy.all, count: budgetRows.length },
                  { id: "ok" as const, label: copy.ok, count: statusCounts.ok },
                  { id: "near" as const, label: copy.attention, count: statusCounts.near },
                  { id: "over" as const, label: copy.over, count: statusCounts.over }
                ].map((option) => (
                  <button key={option.id} className={filter === option.id ? "active" : ""} type="button" onClick={() => setFilter(option.id)}>
                    {option.label}
                    <span>{option.count}</span>
                  </button>
                ))}
              </div>
              <a className="budget-add-category" href="/categories">
                <span aria-hidden="true">+</span>
                {copy.addCategory}
              </a>
            </div>
          </div>

          {groupedRows.length === 0 ? (
            <div className="budget-empty-state">
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyBody}</p>
            </div>
          ) : (
            <div className="budget-groups">
              {groupedRows.map((group) => {
                const groupPlanned = group.rows.reduce((sum, row) => sum + row.planned, 0);
                const groupSpent = group.rows.reduce((sum, row) => sum + row.spent, 0);
                const groupPercent = groupPlanned > 0 ? Math.round((groupSpent / groupPlanned) * 100) : 0;

                return (
                  <section key={group.id} className="budget-envelope-group">
                    <div className="budget-group-heading">
                      <div>
                        <span><BudgetsIcon /> {group.label}</span>
                        <p>{group.description}</p>
                      </div>
                      <strong>{formatCurrency(groupSpent, mainCurrencyCode)} <span>{t("common.of")} {formatCurrency(groupPlanned, mainCurrencyCode)} · {groupPercent}%</span></strong>
                    </div>

                    <div className="budget-envelope-list">
                      {group.rows.map((row) => {
                        const progressWidth = `${Math.min(row.ratio, 1) * 100}%`;
                        const inputId = `budget-limit-${row.categoryId}`;
                        const statusLabel = row.status === "over"
                          ? copy.over
                          : row.status === "near"
                            ? copy.nearLimit
                            : row.status === "unset"
                              ? copy.noLimit
                              : copy.ok;

                        return (
                          <article
                            key={row.categoryId}
                            className={`budget-envelope-row is-${row.status}`}
                            style={{ "--row-accent": row.color } as CSSProperties}
                          >
                            <div className="budget-envelope-icon" aria-hidden="true">
                              <CategoryIcon />
                            </div>
                            <div className="budget-envelope-main">
                              <div className="budget-envelope-titleline">
                                <strong>{row.categoryName}</strong>
                                <span>· {row.operationCount > 0 ? copy.operation(row.operationCount) : copy.noOperations}</span>
                                <em>{statusLabel}</em>
                              </div>
                              <p>{row.planned > 0 ? `${copy.pace} ${Math.round(row.ratio * 100)}%` : copy.noLimit}</p>
                              <div className="budget-envelope-progress" aria-hidden="true">
                                <div style={{ width: progressWidth }} />
                              </div>
                              <div className="budget-envelope-meta">
                                <span><b>{formatCurrency(row.spent, mainCurrencyCode)}</b> {t("common.of")} {formatCurrency(row.planned, mainCurrencyCode)}</span>
                                <strong>
                                  {row.remaining < 0 ? copy.overBy : copy.remainingAmount} {formatCurrency(Math.abs(row.remaining), mainCurrencyCode)}
                                </strong>
                              </div>
                            </div>
                            <div className="budget-envelope-limit">
                              <span>{copy.monthlyLimit}</span>
                              <div className="budget-limit-input-wrap">
                                <label className="sr-only" htmlFor={inputId}>{row.categoryName}</label>
                                <input
                                  id={inputId}
                                  type="number"
                                  step="0.01"
                                  value={draft.get(row.categoryId) ?? ""}
                                  onChange={(event) => {
                                    const next = new Map(draft);
                                    next.set(row.categoryId, event.target.value);
                                    setDraft(next);
                                  }}
                                />
                                <EditIcon aria-hidden="true" />
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <aside className="budget-side-stack">
          <section className="budget-side-card">
            <div className="budget-side-card-heading">
              <h2><TrendIcon /> {copy.rhythm}</h2>
              <span>{copy.cumulative} · {monthLabel}</span>
            </div>
            <BudgetRhythmChart
              totalPlanned={totalPlanned}
              totalSpent={totalSpent}
              projectedEnd={projectedEnd}
              transactions={transactions}
              selectedMonth={selectedMonth}
              timing={timing}
              currencyCode={mainCurrencyCode}
              languageCode={languageCode}
              copy={copy}
            />
            <div className="budget-chart-legend">
              <span className="actual">{copy.actualSpending}</span>
              <span className="forecast">{copy.forecast}</span>
              <span className="ideal">{copy.idealPace}</span>
            </div>
          </section>

          <section className="budget-side-card budget-projection-card">
            <div className="budget-side-card-heading">
              <h2><TrendIcon /> {copy.projection}</h2>
            </div>
            <strong className={projectionDelta > 0 ? "is-warning" : "is-good"}>
              {formatCurrency(projectedEnd, mainCurrencyCode)}
              <span>{projectionDelta >= 0 ? "+" : ""}{formatCurrency(projectionDelta, mainCurrencyCode)} {copy.vsLimit}</span>
            </strong>
            <p>{projectionDelta > 0 ? copy.currentPaceOver(formatCurrency(dailyAverage, mainCurrencyCode)) : copy.currentPaceOk(formatCurrency(dailyAverage, mainCurrencyCode))}</p>
            <div className="budget-tip">
              <BookmarkIcon />
              <span>
                {projectionDelta > 0 && pressureCategory
                  ? copy.projectionTipOver(pressureCategory.categoryName, formatCurrency(dailyLimit, mainCurrencyCode))
                  : copy.projectionTipOk(formatCurrency(dailyLimit, mainCurrencyCode))}
              </span>
            </div>
          </section>

          <section className="budget-side-card">
            <div className="budget-side-card-heading">
              <h2><BudgetsIcon /> {copy.recurring} · {monthLabel}</h2>
              <a href="/categories">{copy.manage} →</a>
            </div>
            <div className="budget-recurring-list">
              {(recurringRows.length > 0 ? recurringRows : budgetRows.slice(0, 3)).map((row) => (
                <article key={`recurring-${row.categoryId}`}>
                  <span style={{ background: row.color }} />
                  <div>
                    <strong>{row.categoryName}</strong>
                    <p>{row.operationCount > 0 ? copy.operation(row.operationCount) : copy.noOperations}</p>
                  </div>
                  <b>{formatCurrency(row.planned, mainCurrencyCode)}</b>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
