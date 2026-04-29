import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import type { MonthlyReportDraftTransaction } from "../types";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";

export function ImportsPage() {
  const { auth } = useAuth();
  const { accounts, categories, aiSettings, refresh } = useLedgerraData();
  const [accountId, setAccountId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [provider, setProvider] = useState("OpenAi");
  const [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<MonthlyReportDraftTransaction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setProvider(aiSettings?.defaultProvider ?? "OpenAi");
  }, [aiSettings?.defaultProvider]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken || !accountId || !file) {
      return;
    }

    const analysis = await apiClient.analyzeMonthlyReport(auth.accessToken, { accountId, month, provider, file });
    setDrafts(analysis.transactions);
    setSelected(new Set(analysis.transactions.map((transaction) => transaction.sourceId)));
  };

  const updateDraft = (sourceId: string, updates: Partial<MonthlyReportDraftTransaction>) => {
    setDrafts((current) => current.map((draft) => (draft.sourceId === sourceId ? { ...draft, ...updates } : draft)));
  };

  const handleCommit = async () => {
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.commitMonthlyReportDrafts(auth.accessToken, drafts.filter((draft) => selected.has(draft.sourceId)));
    setDrafts([]);
    setSelected(new Set());
    await refresh();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Imports"
        title="Monthly report import"
        description="Parse PDF and CSV account reports into reviewed transaction drafts."
      />

      <SectionCard title="Analyze report">
        <form className="stack-form" onSubmit={handleAnalyze}>
          <label>
            Account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Month
            <input value={month} onChange={(event) => setMonth(event.target.value)} type="month" required />
          </label>
          <label>
            Provider
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="OpenAi">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
            </select>
          </label>
          <label>
            Report file
            <input accept=".pdf,.csv,application/pdf,text/csv" onChange={handleFileChange} type="file" required />
          </label>
          <button className="primary-button" type="submit">
            Analyze report
          </button>
        </form>
      </SectionCard>

      {drafts.length > 0 && (
        <SectionCard title="Review drafts">
          <div className="import-table">
            {drafts.map((draft) => (
              <article className="import-row" key={draft.sourceId}>
                <input
                  aria-label={`Select ${draft.sourceId}`}
                  checked={selected.has(draft.sourceId)}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) {
                        next.add(draft.sourceId);
                      } else {
                        next.delete(draft.sourceId);
                      }

                      return next;
                    });
                  }}
                  type="checkbox"
                />
                <input
                  value={draft.occurredOnUtc.slice(0, 10)}
                  onChange={(event) => updateDraft(draft.sourceId, { occurredOnUtc: new Date(event.target.value).toISOString() })}
                  type="date"
                />
                <select value={draft.type} onChange={(event) => updateDraft(draft.sourceId, { type: event.target.value })}>
                  <option>Expense</option>
                  <option>Income</option>
                </select>
                <select value={draft.categoryId ?? ""} onChange={(event) => updateDraft(draft.sourceId, { categoryId: event.target.value || null })}>
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.amount}
                  onChange={(event) => updateDraft(draft.sourceId, { amount: Number(event.target.value) })}
                  type="number"
                  step="0.01"
                />
                <input value={draft.note ?? ""} onChange={(event) => updateDraft(draft.sourceId, { note: event.target.value })} />
                <strong>{Math.round(draft.confidence * 100)}%</strong>
              </article>
            ))}
          </div>
          <button className="primary-button" onClick={handleCommit} type="button">
            Save selected drafts
          </button>
        </SectionCard>
      )}
    </div>
  );
}
