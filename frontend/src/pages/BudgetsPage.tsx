import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useMonthSelection } from "../state/MonthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { formatCurrency } from "../utils/format";

export function BudgetsPage() {
  const { auth } = useAuth();
  const { selectedYear, selectedMonthNumber } = useMonthSelection();
  const { categories, budget, profile, refresh } = useLedgerraData();
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

  useEffect(() => {
    setDraft(initialValues);
  }, [initialValues]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    const payload = expenseCategories
      .map((category) => ({
        categoryId: category.id,
        plannedAmount: Number(draft.get(category.id) ?? 0)
      }))
      .filter((item) => item.plannedAmount > 0);

    await apiClient.updateBudget(auth.accessToken, selectedYear, selectedMonthNumber, payload);
    await refresh();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Budgets"
        title="Plan the month with intention"
        description="Set limits per expense category and compare them against what has already happened."
      />

      <div className="split-grid wide">
        <SectionCard title="Monthly category limits">
          <form className="stack-form" onSubmit={handleSubmit}>
            {expenseCategories.map((category) => (
              <label key={category.id}>
                {category.name}
                <input
                  type="number"
                  step="0.01"
                  value={draft.get(category.id) ?? ""}
                  onChange={(event) => {
                    const next = new Map(draft);
                    next.set(category.id, event.target.value);
                    setDraft(next);
                  }}
                />
              </label>
            ))}
            <button className="primary-button" type="submit">
              Save budget
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Budget progress">
          <div className="budget-progress-list">
            {budget?.categories.map((item) => {
              const ratio = item.planned > 0 ? Math.min((item.spent / item.planned) * 100, 100) : 0;

              return (
                <article key={item.categoryId} className="budget-progress-row">
                  <div className="budget-progress-copy">
                    <strong>{item.categoryName}</strong>
                    <span>
                      {formatCurrency(item.spent, mainCurrencyCode)} of {formatCurrency(item.planned, mainCurrencyCode)}
                    </span>
                  </div>
                  <div className="budget-progress-bar">
                    <div style={{ width: `${ratio}%` }} />
                  </div>
                  <strong>{formatCurrency(item.remaining, mainCurrencyCode)}</strong>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
