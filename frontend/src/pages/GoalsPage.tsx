import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import { useLedgerraData } from "../hooks/useLedgerraData";
import type { SavingsGoal, Transaction } from "../types";
import { BookmarkIcon, CashFlowIcon, EditIcon, GoalsIcon, TrendIcon } from "../ui/icons";
import { formatCurrency } from "../utils/format";
import { getLocaleForLanguageCode } from "../utils/language";

type GoalFilter = "active" | "all" | "complete";
type GoalSort = "deadline" | "progress";
type GoalDialogMode = "create" | "edit";

const goalThemes = [
  { className: "goal-theme-home", glyph: "H", labelKey: "goals.theme.home" },
  { className: "goal-theme-safety", glyph: "S", labelKey: "goals.theme.safety" },
  { className: "goal-theme-travel", glyph: "T", labelKey: "goals.theme.travel" },
  { className: "goal-theme-tech", glyph: "L", labelKey: "goals.theme.tech" },
  { className: "goal-theme-car", glyph: "A", labelKey: "goals.theme.car" },
  { className: "goal-theme-general", glyph: "G", labelKey: "goals.theme.general" }
] as const;

const dayMs = 24 * 60 * 60 * 1000;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function getDeadlineDate(goal: SavingsGoal) {
  return goal.deadlineUtc ? new Date(goal.deadlineUtc) : null;
}

function getDateInputValue(deadlineUtc?: string | null) {
  if (!deadlineUtc) return "";
  return new Date(deadlineUtc).toISOString().slice(0, 10);
}

function getDaysLeft(goal: SavingsGoal) {
  const deadline = getDeadlineDate(goal);
  if (!deadline) return null;
  return Math.ceil((deadline.getTime() - Date.now()) / dayMs);
}

function getMonthsLeft(goal: SavingsGoal) {
  const days = getDaysLeft(goal);
  if (days === null) return null;
  return Math.max(1, Math.ceil(days / 30.44));
}

function formatDeadline(goal: SavingsGoal, formatter: Intl.DateTimeFormat, noDeadlineLabel: string) {
  const deadline = getDeadlineDate(goal);
  return deadline ? formatter.format(deadline) : noDeadlineLabel;
}

function formatDeadlineShort(goal: SavingsGoal, formatter: Intl.DateTimeFormat, noDeadlineLabel: string) {
  const deadline = getDeadlineDate(goal);
  return deadline ? formatter.format(deadline) : noDeadlineLabel;
}

function getProgress(goal: SavingsGoal) {
  return Math.round(clamp(goal.progressPercent));
}

function getRemaining(goal: SavingsGoal) {
  return Math.max(goal.targetAmount - goal.savedAmount, 0);
}

function getGoalTransactions(goalId: string, transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.savingsGoalId === goalId && transaction.type === "TransferOut")
    .sort((first, second) => new Date(first.occurredOnUtc).getTime() - new Date(second.occurredOnUtc).getTime());
}

function getMonthlyPace(goalId: string, transactions: Transaction[], months = 6) {
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1), 1);
  start.setHours(0, 0, 0, 0);

  const amount = getGoalTransactions(goalId, transactions)
    .filter((transaction) => new Date(transaction.occurredOnUtc) >= start)
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

  return amount / months;
}

function getRequiredMonthly(goal: SavingsGoal) {
  const monthsLeft = getMonthsLeft(goal);
  return monthsLeft === null ? null : getRemaining(goal) / monthsLeft;
}

function getGoalStatus(goal: SavingsGoal, monthlyPace: number) {
  if (getProgress(goal) >= 100) return { labelKey: "goals.status.complete", tone: "success" } as const;
  const requiredMonthly = getRequiredMonthly(goal);
  if (requiredMonthly === null) return { labelKey: "goals.status.openEnded", tone: "neutral" } as const;
  if (monthlyPace >= requiredMonthly) return { labelKey: "goals.status.onTrack", tone: "success" } as const;
  return { labelKey: "goals.status.slow", tone: "warning" } as const;
}

function getGoalTheme(goal: SavingsGoal, index: number) {
  const name = goal.name.toLowerCase();
  if (name.includes("miesz") || name.includes("dom")) return goalThemes[0];
  if (name.includes("awary") || name.includes("fundusz") || name.includes("bezpiec")) return goalThemes[1];
  if (name.includes("wakac") || name.includes("podroz") || name.includes("podró")) return goalThemes[2];
  if (name.includes("laptop") || name.includes("komputer") || name.includes("sprzet") || name.includes("sprzę")) return goalThemes[3];
  if (name.includes("auto") || name.includes("samoch")) return goalThemes[4];
  return goalThemes[index % goalThemes.length];
}

function getProjectedFinish(goal: SavingsGoal, monthlyPace: number, formatter: Intl.DateTimeFormat, completeLabel: string, noPaceLabel: string) {
  if (getProgress(goal) >= 100) return completeLabel;
  if (monthlyPace <= 0) return noPaceLabel;

  const finish = new Date();
  finish.setMonth(finish.getMonth() + Math.ceil(getRemaining(goal) / monthlyPace));
  return formatter.format(finish);
}

function getMilestoneDate(goal: SavingsGoal, goalTransactions: Transaction[], amount: number, formatter: Intl.DateTimeFormat) {
  let running = 0;
  const hit = goalTransactions.find((transaction) => {
    running += Math.abs(transaction.amount);
    return running >= amount;
  });

  if (hit) {
    return formatter.format(new Date(hit.occurredOnUtc));
  }

  return null;
}

function getMonthlyDeposits(goalId: string, transactions: Transaction[], monthFormatter: Intl.DateTimeFormat, months = 10) {
  const buckets: Array<{ label: string; amount: number }> = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - offset, 1);
    date.setHours(0, 0, 0, 0);
    buckets.push({ label: monthFormatter.format(date), amount: 0 });
  }

  getGoalTransactions(goalId, transactions).forEach((transaction) => {
    const date = new Date(transaction.occurredOnUtc);
    const index = buckets.findIndex((bucket, bucketIndex) => {
      const bucketDate = new Date();
      bucketDate.setMonth(bucketDate.getMonth() - (months - 1 - bucketIndex), 1);
      return bucketDate.getFullYear() === date.getFullYear() && bucketDate.getMonth() === date.getMonth();
    });

    if (index >= 0) {
      buckets[index].amount += Math.abs(transaction.amount);
    }
  });

  return buckets;
}

function sortGoals(goals: SavingsGoal[], sort: GoalSort) {
  return [...goals].sort((first, second) => {
    if (sort === "progress") {
      return getProgress(second) - getProgress(first);
    }

    const firstDeadline = getDeadlineDate(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const secondDeadline = getDeadlineDate(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return firstDeadline - secondDeadline;
  });
}

function GoalGlyph({ goal, index }: { goal: SavingsGoal; index: number }) {
  const theme = getGoalTheme(goal, index);
  return <span className={`goal-glyph ${theme.className}`}>{theme.glyph}</span>;
}

export function GoalsPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const { languageCode, t } = useI18n();
  const { profile, transactions, loading: dataLoading } = useLedgerraData({ profile: true, transactions: true });
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GoalFilter>("active");
  const [sort, setSort] = useState<GoalSort>("deadline");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogMode, setDialogMode] = useState<GoalDialogMode>("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const currencyCode = profile?.preferredCurrencyCode ?? "PLN";
  const locale = getLocaleForLanguageCode(languageCode);
  const monthDayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }), [locale]);
  const fullDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }), [locale]);
  const monthShortFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);
  const compactNumberFormatter = useMemo(() => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }), [locale]);

  const refreshGoals = async () => {
    if (!auth?.accessToken) return;
    setLoadingGoals(true);
    try {
      const payload = await apiClient.getSavingsGoals(auth.accessToken);
      setGoals(payload);
      setError(null);
      setSelectedGoalId((current) => current ?? payload[0]?.id ?? null);
    } catch (err) {
      console.error("Failed to load savings goals:", err);
      setError(t("goals.loadError"));
    } finally {
      setLoadingGoals(false);
    }
  };

  useEffect(() => {
    void refreshGoals();
  }, [auth?.accessToken]);

  const visibleGoals = useMemo(() => {
    const searched = goals.filter((goal) => goal.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    const filtered = searched.filter((goal) => {
      if (filter === "complete") return getProgress(goal) >= 100;
      if (filter === "active") return getProgress(goal) < 100;
      return true;
    });
    return sortGoals(filtered, sort);
  }, [filter, goals, searchQuery, sort]);

  const selectedGoal = useMemo(
    () => visibleGoals.find((goal) => goal.id === selectedGoalId) ?? visibleGoals[0] ?? null,
    [selectedGoalId, visibleGoals]
  );

  useEffect(() => {
    if (!selectedGoal && selectedGoalId !== null) {
      setSelectedGoalId(null);
      return;
    }

    if (selectedGoal && selectedGoal.id !== selectedGoalId) {
      setSelectedGoalId(selectedGoal.id);
    }
  }, [selectedGoal, selectedGoalId]);

  const activeGoals = goals.filter((goal) => getProgress(goal) < 100);
  const completedGoals = goals.filter((goal) => getProgress(goal) >= 100);
  const totalSaved = goals.reduce((sum, goal) => sum + goal.savedAmount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const aggregateProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const totalMonthlyPace = goals.reduce((sum, goal) => sum + getMonthlyPace(goal.id, transactions), 0);
  const goalsRequiringPace = activeGoals.filter((goal) => getRequiredMonthly(goal) !== null);
  const goalsInPace = goalsRequiringPace.filter((goal) => {
    const requiredMonthly = getRequiredMonthly(goal);
    return requiredMonthly !== null && getMonthlyPace(goal.id, transactions) >= requiredMonthly;
  }).length;
  const nearestDeadline = sortGoals(activeGoals.filter((goal) => goal.deadlineUtc), "deadline")[0] ?? null;

  const selectedTransactions = selectedGoal ? getGoalTransactions(selectedGoal.id, transactions) : [];
  const selectedMonthlyPace = selectedGoal ? getMonthlyPace(selectedGoal.id, transactions) : 0;
  const selectedRequiredMonthly = selectedGoal ? getRequiredMonthly(selectedGoal) : null;
  const selectedMonthlyDeposits = selectedGoal ? getMonthlyDeposits(selectedGoal.id, transactions, monthShortFormatter) : [];
  const maxMonthlyDeposit = Math.max(...selectedMonthlyDeposits.map((item) => item.amount), 1);
  const selectedGoalThemeIndex = selectedGoal ? goals.findIndex((goal) => goal.id === selectedGoal.id) : -1;
  const selectedGoalTheme = selectedGoal ? getGoalTheme(selectedGoal, selectedGoalThemeIndex) : null;
  const selectedGoalThemeLabel = selectedGoalTheme ? t(selectedGoalTheme.labelKey) : "";

  const openCreateDialog = () => {
    setDialogMode("create");
    setName("");
    setTargetAmount("0");
    setDeadline("");
    setDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedGoal) return;
    setDialogMode("edit");
    setName(selectedGoal.name);
    setTargetAmount(String(selectedGoal.targetAmount));
    setDeadline(getDateInputValue(selectedGoal.deadlineUtc));
    setDialogOpen(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) return;
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        targetAmount: Number(targetAmount),
        deadlineUtc: deadline ? new Date(`${deadline}T12:00:00.000Z`).toISOString() : null
      };

      const savedGoal = dialogMode === "edit" && selectedGoal
        ? await apiClient.updateSavingsGoal(auth.accessToken, selectedGoal.id, payload)
        : await apiClient.createSavingsGoal(auth.accessToken, payload);

      setSelectedGoalId(savedGoal.id);
      setDialogOpen(false);
      setError(null);
      await refreshGoals();
    } catch (err) {
      console.error("Failed to save savings goal:", err);
      setError(t("goals.saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="goals-page">
      <header className="goals-topbar">
        <div className="goals-breadcrumb">{t("goals.breadcrumb")}</div>
        <label className="goals-search" aria-label={t("goals.searchAria")}>
          <span>⌕</span>
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("goals.searchPlaceholder")} />
        </label>
      </header>

      <section className="goals-hero">
        <div>
          <span className="eyebrow">{t("goals.eyebrow")}</span>
          <h1>{t("goals.title")}</h1>
          <p>{t("goals.description")}</p>
        </div>

        <div className="goals-actions">
          <div className="goals-filter-tabs" role="tablist" aria-label={t("goals.filterAria")}>
            <button className={filter === "active" ? "is-active" : ""} type="button" onClick={() => setFilter("active")}>{t("goals.filter.active")}</button>
            <button className={filter === "all" ? "is-active" : ""} type="button" onClick={() => setFilter("all")}>{t("goals.filter.all")}</button>
            <button className={filter === "complete" ? "is-active" : ""} type="button" onClick={() => setFilter("complete")}>{t("goals.filter.complete")}</button>
          </div>
          <button className="ghost-button goals-sort-button" type="button" onClick={() => setSort((current) => current === "deadline" ? "progress" : "deadline")}>
            <TrendIcon /> {sort === "deadline" ? t("goals.sort.deadline") : t("goals.sort.progress")}
          </button>
          <button className="primary-button goals-new-button" type="button" onClick={openCreateDialog}>
            <span aria-hidden="true">+</span> {t("goals.newGoal")}
          </button>
        </div>
      </section>

      {error && <div className="goals-error">{error}</div>}

      <section className="goals-summary-strip" aria-label={t("goals.summaryAria")}>
        <article>
          <span>{t("goals.totalSaved")}</span>
          <strong>{formatCurrency(totalSaved, currencyCode)}</strong>
          <p><b>{aggregateProgress}%</b> {t("goals.aggregateTarget", { target: formatCurrency(totalTarget, currencyCode) })}</p>
        </article>
        <article>
          <span>{t("goals.monthlyPace")}</span>
          <strong className="accent-value">+ {formatCurrency(totalMonthlyPace, currencyCode)}</strong>
          <p>{t("goals.sixMonthAverage")}</p>
        </article>
        <article>
          <span>{t("goals.onTrack")}</span>
          <strong>{t("goals.goalRatio", { current: goalsInPace, total: activeGoals.length })}</strong>
          <p>{t("goals.needCorrection", { count: Math.max(goalsRequiringPace.length - goalsInPace, 0) })}</p>
        </article>
        <article>
          <span>{t("goals.nearestDeadline")}</span>
          <strong>{nearestDeadline ? formatDeadlineShort(nearestDeadline, monthDayFormatter, t("goals.noDeadline")) : t("goals.none")}</strong>
          <p>{nearestDeadline ? t("goals.deadlineInDays", { name: nearestDeadline.name, days: Math.max(getDaysLeft(nearestDeadline) ?? 0, 0) }) : t("goals.addDeadline")}</p>
        </article>
      </section>

      <section className="goals-layout">
        <aside className="goals-list-panel">
          <div className="goals-list-heading">
            <span>{t("goals.yourGoals")}</span>
            <strong>{t("goals.activeCount", { count: activeGoals.length })}</strong>
          </div>

          {loadingGoals || dataLoading ? (
            <div className="goals-empty">{t("goals.loading")}</div>
          ) : visibleGoals.length === 0 ? (
            <div className="goals-empty">{t("goals.emptyList")}</div>
          ) : (
            <div className="goals-list">
              {visibleGoals.map((goal, index) => {
                const progress = getProgress(goal);
                const monthlyPace = getMonthlyPace(goal.id, transactions);
                const status = getGoalStatus(goal, monthlyPace);
                const selected = goal.id === selectedGoal?.id;

                return (
                  <button
                    key={goal.id}
                    type="button"
                    className={`goal-list-card ${selected ? "is-selected" : ""} ${status.tone === "warning" ? "is-warning" : ""}`}
                    onClick={() => setSelectedGoalId(goal.id)}
                  >
                    <GoalGlyph goal={goal} index={index} />
                    <div className="goal-list-main">
                      <div className="goal-list-title">
                        <strong>{goal.name}</strong>
                        <BookmarkIcon />
                        <span>{compactNumberFormatter.format(goal.savedAmount)}</span>
                      </div>
                      <p>{t("goals.goalDue", { theme: t(getGoalTheme(goal, index).labelKey), deadline: formatDeadlineShort(goal, monthDayFormatter, t("goals.noDeadline")) })}</p>
                      <div className="goal-progress-track"><span style={{ width: `${progress}%` }} /></div>
                      <div className="goal-list-footer">
                        <span><b>{progress}%</b> · {t("goals.remaining", { amount: formatCurrency(getRemaining(goal), currencyCode) })}</span>
                        <em className={`goal-status-${status.tone}`}>• {t(status.labelKey)}</em>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="goals-detail-stack">
          {selectedGoal ? (
            <>
              <section className="goal-detail-card">
                <div className="goal-ring" style={{ "--goal-progress": `${getProgress(selectedGoal)}%` } as CSSProperties}>
                  <div>
                    <strong>{getProgress(selectedGoal)}%</strong>
                    <span>{selectedGoalThemeLabel}</span>
                  </div>
                </div>

                <div className="goal-detail-content">
                  <div className="goal-detail-kicker">
                    <GoalGlyph goal={selectedGoal} index={selectedGoalThemeIndex} />
                    <span>{selectedGoalThemeLabel}</span>
                    <em><BookmarkIcon /> {t("goals.favorite")}</em>
                  </div>
                  <h2>{selectedGoal.name}</h2>
                  <p>{t("goals.openForTransfers")} · {t("goals.deadline")} <b>{formatDeadline(selectedGoal, fullDateFormatter, t("goals.noDeadline"))}</b></p>

                  <div className="goal-detail-metrics">
                    <article>
                      <span>{t("goals.saved")}</span>
                      <strong>{formatCurrency(selectedGoal.savedAmount, currencyCode)}</strong>
                    </article>
                    <article>
                      <span>{t("goals.toGoal")}</span>
                      <strong>{formatCurrency(getRemaining(selectedGoal), currencyCode)}</strong>
                    </article>
                    <article>
                      <span>{t("goals.requiredPace")}</span>
                      <strong className="accent-value">
                        {selectedRequiredMonthly === null ? t("goals.noDeadline") : t("goals.perMonth", { amount: formatCurrency(selectedRequiredMonthly, currencyCode) })}
                      </strong>
                    </article>
                    <article>
                      <span>{t("goals.yourPace")}</span>
                      <strong>{t("goals.perMonth", { amount: formatCurrency(selectedMonthlyPace, currencyCode) })}</strong>
                    </article>
                  </div>

                  <div className="goal-detail-actions">
                    <button className="primary-button" type="button" onClick={() => navigate(`/transactions?form=transfer&savingsGoalId=${selectedGoal.id}`)}>+ {t("goals.addDeposit")}</button>
                    <button className="ghost-button" type="button" onClick={() => navigate(`/transactions?form=transfer&savingsGoalId=${selectedGoal.id}`)}><CashFlowIcon /> {t("goals.autoTransfer")}</button>
                    <button className="ghost-button" type="button" onClick={openEditDialog}><EditIcon /> {t("goals.editGoal")}</button>
                    <p>{t("goals.projectedFinish")} <b>{getProjectedFinish(selectedGoal, selectedMonthlyPace, fullDateFormatter, t("goals.goalComplete"), t("goals.noPace"))}</b></p>
                  </div>
                </div>
              </section>

              <section className="goals-panel milestones-panel">
                <div className="goals-panel-heading">
                  <h3><GoalsIcon /> {t("goals.milestones")}</h3>
                  <span>{t("goals.milestonesReached", { reached: [25, 50, 75, 100].filter((point) => getProgress(selectedGoal) >= point).length, total: 4 })}</span>
                </div>
                <div className="milestone-timeline">
                  <span style={{ width: `${getProgress(selectedGoal)}%` }} />
                </div>
                <div className="milestone-grid">
                  {[25, 50, 75, 100].map((point) => {
                    const amount = selectedGoal.targetAmount * (point / 100);
                    const reached = getProgress(selectedGoal) >= point;
                    const milestoneDate = getMilestoneDate(selectedGoal, selectedTransactions, amount, fullDateFormatter);
                    return (
                      <article key={point} className={reached ? "is-reached" : ""}>
                        <span>{reached ? "◉" : "○"} {point}%</span>
                        <strong>{formatCurrency(amount, currencyCode)}</strong>
                        <p>{milestoneDate ? t(reached ? "goals.milestoneReachedOn" : "goals.milestonePlannedOn", { date: milestoneDate }) : t("goals.tbd")}</p>
                      </article>
                    );
                  })}
                </div>
              </section>

              <div className="goals-bottom-grid">
                <section className="goals-panel">
                  <div className="goals-panel-heading">
                    <h3><TrendIcon /> {t("goals.monthlyDeposits")}</h3>
                    <div className="mini-tabs"><span>{t("goals.threeMonths")}</span><b>{t("goals.tenMonths")}</b><span>{t("goals.all")}</span></div>
                  </div>
                  <div className="deposit-chart">
                    {selectedMonthlyDeposits.map((item) => (
                      <div key={item.label}>
                        <span style={{ height: `${Math.max((item.amount / maxMonthlyDeposit) * 100, item.amount > 0 ? 8 : 2)}%` }} />
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="goals-panel recent-goal-panel">
                  <div className="goals-panel-heading">
                    <h3><CashFlowIcon /> {t("goals.recentDeposits")}</h3>
                  </div>
                  {selectedTransactions.slice(-4).reverse().length > 0 ? (
                    <div className="recent-goal-list">
                      {selectedTransactions.slice(-4).reverse().map((transaction) => (
                        <article key={transaction.id}>
                          <span>↓</span>
                          <div>
                            <Link to={`/transactions?type=TransferOut&savingsGoalId=${selectedGoal.id}&from=${transaction.occurredOnUtc.slice(0, 10)}&to=${transaction.occurredOnUtc.slice(0, 10)}`}><strong>+ {formatCurrency(Math.abs(transaction.amount), currencyCode)}</strong></Link>
                            <p>{fullDateFormatter.format(new Date(transaction.occurredOnUtc))}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="goals-muted">{t("goals.noLinkedDeposits")}</p>
                  )}
                </section>
              </div>
            </>
          ) : (
            <section className="goal-detail-empty">
              <GoalsIcon />
              <h2>{t("goals.createFirstTitle")}</h2>
              <p>{t("goals.createFirstDescription")}</p>
              <button className="primary-button" type="button" onClick={openCreateDialog}>+ {t("goals.newGoal")}</button>
            </section>
          )}
        </div>
      </section>

      {dialogOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setDialogOpen(false)}>
          <section className="modal-card goal-modal" role="dialog" aria-modal="true" aria-label={dialogMode === "edit" ? t("goals.editGoal") : t("goals.newGoal")} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">{t("goals.eyebrow")}</span>
                <h2>{dialogMode === "edit" ? t("goals.editGoal") : t("goals.newGoal")}</h2>
              </div>
              <button className="ghost-button compact-button" type="button" onClick={() => setDialogOpen(false)}>×</button>
            </div>
            <form className="stack-form" onSubmit={onSubmit}>
              <label>
                {t("goals.form.name")}
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("goals.form.namePlaceholder")} required />
              </label>
              <label>
                {t("goals.form.targetAmount")}
                <input type="number" min="0" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} required />
              </label>
              <label>
                {t("goals.form.deadline")}
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              </label>
              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</button>
                <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t("goals.form.saving") : t("goals.form.save")}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
