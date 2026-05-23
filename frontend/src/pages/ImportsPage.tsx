import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import type { MonthlyReportAnalysis, MonthlyReportAnalysisJob, MonthlyReportDraftTransaction } from "../types";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";

const MAX_IMPORT_RULE_NAME_LENGTH = 120;
const MAX_IMPORT_RULE_MATCH_VALUE_LENGTH = 200;

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function getErrorMessage(exception: unknown, fallback: string) {
  return exception instanceof Error ? exception.message : fallback;
}

function readFileText(file: File) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsText(file);
  });
}

function extractCsvHeaders(text: string) {
  const headerRow = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  return headerRow.split(",").map((value) => value.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

export function ImportsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { accounts, categories, aiSettings, refresh } = useLedgerraData({
    accounts: true,
    categories: true,
    aiSettings: true
  });
  const [accountId, setAccountId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [provider, setProvider] = useState("OpenAi");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [dateColumn, setDateColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [descriptionColumn, setDescriptionColumn] = useState("");
  const [drafts, setDrafts] = useState<MonthlyReportDraftTransaction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acceptedDuplicateSourceIds, setAcceptedDuplicateSourceIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [analysisJob, setAnalysisJob] = useState<MonthlyReportAnalysisJob | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [rememberingRuleSourceId, setRememberingRuleSourceId] = useState<string | null>(null);
  const [isRememberingSelectedRules, setIsRememberingSelectedRules] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("");

  useEffect(() => {
    setProvider(aiSettings?.defaultProvider ?? "OpenAi");
  }, [aiSettings?.defaultProvider]);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisElapsedSeconds(0);
      return;
    }

    setAnalysisElapsedSeconds(0);
    const timerId = window.setInterval(() => {
      setAnalysisElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isAnalyzing]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setCsvHeaders([]);
    setDateColumn("");
    setAmountColumn("");
    setDescriptionColumn("");
    setError(null);

    if (nextFile && nextFile.name.toLowerCase().endsWith(".csv")) {
      const text = await readFileText(nextFile);
      const headers = extractCsvHeaders(text);
      setCsvHeaders(headers);
      setDateColumn(headers.find((header) => /date/i.test(header)) ?? headers[0] ?? "");
      setAmountColumn(headers.find((header) => /amount|debit|credit/i.test(header)) ?? headers[1] ?? "");
      setDescriptionColumn(headers.find((header) => /description|memo|note/i.test(header)) ?? "");
    }
  };

  const applyAnalysis = (analysis: MonthlyReportAnalysis) => {
    setDrafts(analysis.transactions);
    setSelected(
      new Set(
        analysis.transactions
          .filter((transaction) => transaction.isSelectedByDefault ?? !transaction.isLikelyDuplicate)
          .map((transaction) => transaction.sourceId)
      )
    );
    setAcceptedDuplicateSourceIds(
      new Set(
        analysis.transactions
          .filter((transaction) => transaction.isLikelyDuplicate && transaction.isSelectedByDefault)
          .map((transaction) => transaction.sourceId)
      )
    );
    setHideDuplicates(false);
    setBulkCategoryId("");
  };

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken || !accountId || !file) {
      return;
    }

    setError(null);
    setRuleMessage(null);
    setAnalysisJob(null);
    setIsAnalyzing(true);
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      let selectedDateColumn = dateColumn;
      let selectedAmountColumn = amountColumn;
      let selectedDescriptionColumn = descriptionColumn;

      if (isCsv && (!selectedDateColumn || !selectedAmountColumn)) {
        const headers = csvHeaders.length > 0 ? csvHeaders : extractCsvHeaders(await readFileText(file));
        selectedDateColumn = selectedDateColumn || headers.find((header) => /date/i.test(header)) || headers[0] || "";
        selectedAmountColumn = selectedAmountColumn || headers.find((header) => /amount|debit|credit/i.test(header)) || headers[1] || "";
        selectedDescriptionColumn = selectedDescriptionColumn || headers.find((header) => /description|memo|note/i.test(header)) || "";
        setCsvHeaders(headers);
        setDateColumn(selectedDateColumn);
        setAmountColumn(selectedAmountColumn);
        setDescriptionColumn(selectedDescriptionColumn);

        if (!selectedDateColumn || !selectedAmountColumn) {
          setError(t("imports.mapCsvColumns"));
          return;
        }
      }

      const analysis = isCsv
        ? await apiClient.previewCsvBankImport(auth.accessToken, {
            accountId,
            file,
            dateColumn: selectedDateColumn,
            amountColumn: selectedAmountColumn,
            descriptionColumn: selectedDescriptionColumn
          })
        : await apiClient.analyzeMonthlyReport(auth.accessToken, { accountId, month, provider, file }, setAnalysisJob);
      applyAnalysis(analysis);
    } catch (exception) {
      setError(getErrorMessage(exception, t("imports.unableToAnalyze")));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetrySavedAnalysis = async () => {
    if (!auth?.accessToken || !analysisJob?.jobId) {
      return;
    }

    setError(null);
    setRuleMessage(null);
    setIsAnalyzing(true);
    setAnalysisJob((current) => current
      ? { ...current, status: "running", statusMessage: t("imports.retryingSavedAnalysis"), error: null }
      : current);
    try {
      const analysis = await apiClient.retryMonthlyReportAnalysisParse(auth.accessToken, analysisJob.jobId, setAnalysisJob);
      if (analysis) {
        applyAnalysis(analysis);
      }
    } catch (exception) {
      setError(getErrorMessage(exception, t("imports.unableToAnalyze")));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadSavedAnalysis = async () => {
    if (!auth?.accessToken || !analysisJob?.jobId) {
      return;
    }

    setError(null);
    setRuleMessage(null);
    try {
      const { blob, filename } = await apiClient.downloadMonthlyReportAnalysisRawOutput(auth.accessToken, analysisJob.jobId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (exception) {
      setError(getErrorMessage(exception, t("imports.unableToDownloadSavedAnalysis")));
    }
  };

  const analysisProgressDetails = analysisJob
    ? [
        analysisJob.statusMessage,
        typeof analysisJob.generatedOutputCharacters === "number"
          ? t("imports.analysisGenerated", { count: analysisJob.generatedOutputCharacters })
          : null,
        analysisJob.usage
          ? t("imports.analysisTokens", {
              total: analysisJob.usage.totalTokens,
              prompt: analysisJob.usage.promptTokens,
              completion: analysisJob.usage.completionTokens
            })
          : null
      ].filter(Boolean).join(" ")
    : null;
  const shouldShowAnalysisStatus = isAnalyzing
    ? analysisElapsedSeconds >= 10 || Boolean(analysisProgressDetails)
    : Boolean(analysisJob?.usage);

  const updateDraft = (sourceId: string, updates: Partial<MonthlyReportDraftTransaction>) => {
    setDrafts((current) => current.map((draft) => (draft.sourceId === sourceId ? { ...draft, ...updates } : draft)));
  };

  const buildImportRulePayload = (draft: MonthlyReportDraftTransaction) => {
    const note = truncateText(draft.note?.trim() ?? "", MAX_IMPORT_RULE_MATCH_VALUE_LENGTH);
    const category = categories.find((item) => item.id === draft.categoryId);

    return {
      name: truncateText(`${note} -> ${category?.name ?? draft.type}`, MAX_IMPORT_RULE_NAME_LENGTH),
      matchField: "Note",
      matchOperator: "Contains",
      matchValue: note,
      assignCategoryId: draft.categoryId ?? "",
      assignTransactionType: draft.type,
      priority: 100,
      isActive: true
    };
  };

  const rememberRule = async (draft: MonthlyReportDraftTransaction) => {
    if (!auth?.accessToken || !draft.note?.trim() || !draft.categoryId) {
      return;
    }

    setError(null);
    setRuleMessage(null);
    setRememberingRuleSourceId(draft.sourceId);
    try {
      await apiClient.createImportRule(auth.accessToken, buildImportRulePayload(draft));
      await refresh();
      setRuleMessage(t("imports.ruleSaved"));
    } catch (exception) {
      setError(getErrorMessage(exception, t("imports.unableToSaveRule")));
    } finally {
      setRememberingRuleSourceId(null);
    }
  };

  const visibleDrafts = hideDuplicates ? drafts.filter((draft) => !draft.isLikelyDuplicate) : drafts;
  const selectedDraftCount = selected.size;
  const selectedRuleReadyDrafts = drafts.filter((draft) => selected.has(draft.sourceId) && draft.note?.trim() && draft.categoryId);

  const selectAllDrafts = () => {
    setSelected(new Set(drafts.map((draft) => draft.sourceId)));
    setAcceptedDuplicateSourceIds(new Set(drafts.filter((draft) => draft.isLikelyDuplicate).map((draft) => draft.sourceId)));
  };

  const selectSafeDrafts = () => {
    const safeDrafts = drafts.filter((draft) => !draft.isLikelyDuplicate && draft.confidence >= 0.8 && draft.warnings.length === 0);
    setSelected(new Set(safeDrafts.map((draft) => draft.sourceId)));
    setAcceptedDuplicateSourceIds(new Set());
  };

  const clearSelectedDrafts = () => {
    setSelected(new Set());
    setAcceptedDuplicateSourceIds(new Set());
  };

  const applyBulkCategory = () => {
    if (!bulkCategoryId || selected.size === 0) {
      return;
    }

    const category = categories.find((item) => item.id === bulkCategoryId);
    setDrafts((current) =>
      current.map((draft) => (selected.has(draft.sourceId) ? { ...draft, categoryId: bulkCategoryId } : draft))
    );
    setRuleMessage(t("imports.appliedBulkCategory", { category: category?.name ?? t("settings.category"), count: selected.size }));
    setError(null);
  };

  const rememberSelectedRules = async () => {
    if (!auth?.accessToken || selectedRuleReadyDrafts.length === 0) {
      return;
    }

    setError(null);
    setRuleMessage(null);
    setIsRememberingSelectedRules(true);
    try {
      await Promise.all(selectedRuleReadyDrafts.map((draft) => apiClient.createImportRule(auth.accessToken, buildImportRulePayload(draft))));
      await refresh();
      setRuleMessage(t("imports.rulesSaved", { count: selectedRuleReadyDrafts.length }));
    } catch (exception) {
      setError(getErrorMessage(exception, t("imports.unableToSaveSelectedRules")));
    } finally {
      setIsRememberingSelectedRules(false);
    }
  };

  const handleCommit = async () => {
    if (!auth?.accessToken) {
      return;
    }

    if (selected.size === 0) {
      setError(t("imports.selectAtLeastOne"));
      setRuleMessage(null);
      return;
    }

    setError(null);
    setRuleMessage(null);
    setIsCommitting(true);
    try {
      await apiClient.commitMonthlyReportDrafts(
        auth.accessToken,
        drafts.filter((draft) => selected.has(draft.sourceId)),
        Array.from(acceptedDuplicateSourceIds)
      );
      setDrafts([]);
      setSelected(new Set());
      setAcceptedDuplicateSourceIds(new Set());
      await refresh();
    } catch (exception) {
      setError(getErrorMessage(exception, t("imports.unableToSaveSelectedDrafts")));
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t("imports.eyebrow")}
        title={t("imports.title")}
        description={t("imports.description")}
      />

      <SectionCard title={t("imports.analyzeReport")}>
        <form className="stack-form" onSubmit={handleAnalyze}>
          {error ? <p className="error-banner">{error}</p> : null}
          <label>
            {t("reports.account")}
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required disabled={isAnalyzing}>
              <option value="">{t("common.selectAccount")}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("imports.month")}
            <input value={month} onChange={(event) => setMonth(event.target.value)} type="month" required disabled={isAnalyzing} />
          </label>
          <label>
            {t("imports.provider")}
            <select value={provider} onChange={(event) => setProvider(event.target.value)} disabled={isAnalyzing}>
              <option value="OpenAi">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
              <option value="OpenAiCompatible">OpenAI compatible</option>
            </select>
          </label>
          <label>
            {t("imports.reportFile")}
            <input accept=".pdf,.csv,application/pdf,text/csv" onChange={handleFileChange} type="file" required disabled={isAnalyzing} />
          </label>

          {csvHeaders.length > 0 ? (
            <>
              <label>
                {t("imports.dateColumn")}
                <select value={dateColumn} onChange={(event) => { setDateColumn(event.target.value); setError(null); }} required disabled={isAnalyzing}>
                  {csvHeaders.map((header) => <option key={`date-${header}`} value={header}>{header}</option>)}
                </select>
              </label>
              <label>
                {t("imports.amountColumn")}
                <select value={amountColumn} onChange={(event) => { setAmountColumn(event.target.value); setError(null); }} required disabled={isAnalyzing}>
                  {csvHeaders.map((header) => <option key={`amount-${header}`} value={header}>{header}</option>)}
                </select>
              </label>
              <label>
                {t("imports.descriptionColumn")}
                <select value={descriptionColumn} onChange={(event) => { setDescriptionColumn(event.target.value); setError(null); }} disabled={isAnalyzing}>
                  <option value="">(none)</option>
                  {csvHeaders.map((header) => <option key={`description-${header}`} value={header}>{header}</option>)}
                </select>
              </label>
            </>
          ) : null}

          <button className="primary-button" type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? t("imports.analyzing") : t("imports.analyzeReport")}
          </button>
          {shouldShowAnalysisStatus ? (
            <p className="form-helper" role="status">
              {isAnalyzing && analysisProgressDetails
                ? t("imports.analysisProgress", { elapsed: analysisElapsedSeconds, details: analysisProgressDetails })
                : analysisProgressDetails
                  ? analysisProgressDetails
                : t("imports.analysisStillRunning", { elapsed: analysisElapsedSeconds })}
            </p>
          ) : null}
          {!isAnalyzing && analysisJob?.status === "failed" && analysisJob.hasRawAiOutput ? (
            <div className="form-actions">
              <button className="ghost-button compact-button" type="button" onClick={() => void handleRetrySavedAnalysis()}>
                {t("imports.retrySavedAnalysis")}
              </button>
              <button className="ghost-button compact-button" type="button" onClick={() => void handleDownloadSavedAnalysis()}>
                {t("imports.downloadSavedAnalysis")}
              </button>
            </div>
          ) : null}
        </form>
      </SectionCard>

      {drafts.length > 0 && (
        <SectionCard title={t("imports.reviewDrafts")}>
          {ruleMessage ? <p className="success-banner">{ruleMessage}</p> : null}
          <div className="review-toolbar" aria-label={t("imports.reviewTools")}>
            <div className="review-toolbar-actions">
              <strong>{t("imports.selectedCount", { count: selectedDraftCount })}</strong>
              <button className="ghost-button compact-button" type="button" onClick={selectSafeDrafts}>
                {t("imports.selectSafeDrafts")}
              </button>
              <button className="ghost-button compact-button" type="button" onClick={selectAllDrafts}>
                {t("imports.selectAll")}
              </button>
              <button className="ghost-button compact-button" type="button" onClick={clearSelectedDrafts}>
                {t("imports.clear")}
              </button>
              <button
                className="ghost-button compact-button"
                type="button"
                onClick={() => void rememberSelectedRules()}
                disabled={selectedRuleReadyDrafts.length === 0 || isRememberingSelectedRules}
              >
                {isRememberingSelectedRules ? t("imports.savingRules") : t("imports.rememberSelectedRules")}
              </button>
              <label className="inline-checkbox">
                <input checked={hideDuplicates} onChange={(event) => setHideDuplicates(event.target.checked)} type="checkbox" />
                {t("imports.hideDuplicates")}
              </label>
            </div>
            <div className="bulk-category-actions">
              <label>
                {t("imports.bulkCategory")}
                <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}>
                  <option value="">{t("common.chooseCategory")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="ghost-button compact-button" type="button" onClick={applyBulkCategory} disabled={!bulkCategoryId || selected.size === 0}>
                {t("imports.applyToSelected")}
              </button>
            </div>
          </div>
          <div className="import-table">
            {visibleDrafts.map((draft) => (
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
                  <option value="Expense">{t("transactionType.Expense")}</option>
                  <option value="Income">{t("transactionType.Income")}</option>
                </select>
                <select value={draft.categoryId ?? ""} onChange={(event) => updateDraft(draft.sourceId, { categoryId: event.target.value || null })}>
                  <option value="">{t("imports.noCategory")}</option>
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
                  {draft.isLikelyDuplicate ? <span className="status-badge danger">{t("imports.duplicateFlag")}</span> : null}
                  {draft.duplicateReason ? <small>{draft.duplicateReason}</small> : null}
                  {draft.warnings.map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                  {draft.note?.trim() && draft.categoryId ? (
                    <button
                      className="ghost-button compact-button"
                      type="button"
                      onClick={() => rememberRule(draft)}
                      disabled={rememberingRuleSourceId === draft.sourceId}
                    >
                      {rememberingRuleSourceId === draft.sourceId ? t("imports.savingRule") : t("imports.rememberThis")}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <button className="primary-button" onClick={handleCommit} type="button" disabled={isCommitting}>
            {isCommitting ? t("imports.savingDrafts") : t("imports.saveSelectedDrafts")}
          </button>
        </SectionCard>
      )}
    </div>
  );
}
