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
  const [acceptedDuplicateSourceIds, setAcceptedDuplicateSourceIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

    setError(null);
    setRuleMessage(null);
    setIsAnalyzing(true);
    try {
      const analysis = await apiClient.analyzeMonthlyReport(auth.accessToken, { accountId, month, provider, file });
      setDrafts(analysis.transactions);
      setSelected(
        new Set(
          analysis.transactions
            .filter((transaction) => transaction.isSelectedByDefault ?? !transaction.isLikelyDuplicate)
            .map((transaction) => transaction.sourceId)
        )
      );
      setAcceptedDuplicateSourceIds(new Set());
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unable to analyze report.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateDraft = (sourceId: string, updates: Partial<MonthlyReportDraftTransaction>) => {
    setDrafts((current) => current.map((draft) => (draft.sourceId === sourceId ? { ...draft, ...updates } : draft)));
  };

  const rememberRule = async (draft: MonthlyReportDraftTransaction) => {
    if (!auth?.accessToken || !draft.note?.trim() || !draft.categoryId) {
      return;
    }

    const note = draft.note.trim();
    const category = categories.find((item) => item.id === draft.categoryId);
    await apiClient.createImportRule(auth.accessToken, {
      name: `${note} -> ${category?.name ?? draft.type}`,
      matchField: "Note",
      matchOperator: "Contains",
      matchValue: note,
      assignCategoryId: draft.categoryId,
      assignTransactionType: draft.type,
      priority: 100,
      isActive: true
    });
    setRuleMessage("Import rule saved.");
  };

  const handleCommit = async () => {
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.commitMonthlyReportDrafts(
      auth.accessToken,
      drafts.filter((draft) => selected.has(draft.sourceId)),
      Array.from(acceptedDuplicateSourceIds)
    );
    setDrafts([]);
    setSelected(new Set());
    setAcceptedDuplicateSourceIds(new Set());
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
          {error ? <p className="error-banner">{error}</p> : null}
          <label>
            Account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required disabled={isAnalyzing}>
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
            <input value={month} onChange={(event) => setMonth(event.target.value)} type="month" required disabled={isAnalyzing} />
          </label>
          <label>
            Provider
            <select value={provider} onChange={(event) => setProvider(event.target.value)} disabled={isAnalyzing}>
              <option value="OpenAi">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
            </select>
          </label>
          <label>
            Report file
            <input accept=".pdf,.csv,application/pdf,text/csv" onChange={handleFileChange} type="file" required disabled={isAnalyzing} />
          </label>
          <button className="primary-button" type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? "Analyzing..." : "Analyze report"}
          </button>
        </form>
      </SectionCard>

      {drafts.length > 0 && (
        <SectionCard title="Review drafts">
          {ruleMessage ? <p className="success-banner">{ruleMessage}</p> : null}
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
                    setAcceptedDuplicateSourceIds((current) => {
                      const next = new Set(current);
                      if (draft.isLikelyDuplicate && event.target.checked) {
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
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      updateDraft(draft.sourceId, { occurredOnUtc: "" });
                      return;
                    }

                    const parsedDate = new Date(value);
                    if (!Number.isNaN(parsedDate.getTime())) {
                      updateDraft(draft.sourceId, { occurredOnUtc: parsedDate.toISOString() });
                    }
                  }}
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
                  onChange={(event) => {
                    const parsedAmount = Number.parseFloat(event.target.value);
                    updateDraft(draft.sourceId, { amount: Number.isFinite(parsedAmount) ? parsedAmount : 0 });
                  }}
                  type="number"
                  step="0.01"
                />
                <input value={draft.note ?? ""} onChange={(event) => updateDraft(draft.sourceId, { note: event.target.value })} />
                <strong>{Math.round(draft.confidence * 100)}%</strong>
                <div className="import-review-flags">
                  {draft.appliedRuleName ? <span className="status-badge success">{draft.appliedRuleName}</span> : null}
                  {draft.isLikelyDuplicate ? <span className="status-badge danger">Duplicate</span> : null}
                  {draft.duplicateReason ? <small>{draft.duplicateReason}</small> : null}
                  {draft.warnings.map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                  {draft.note?.trim() && draft.categoryId ? (
                    <button className="ghost-button compact-button" type="button" onClick={() => rememberRule(draft)}>
                      Remember this
                    </button>
                  ) : null}
                </div>
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
