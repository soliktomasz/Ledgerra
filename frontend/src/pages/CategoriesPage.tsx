import { FormEvent, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";

function getCategoryKindLabel(kind: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (kind) {
    case "Expense":
      return t("transactionType.Expense");
    case "Income":
      return t("transactionType.Income");
    default:
      return kind;
  }
}

export function CategoriesPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { categories, refresh } = useLedgerraData({ categories: true });
  const [name, setName] = useState("");
  const [kind, setKind] = useState("Expense");
  const [color, setColor] = useState("#5f8f7b");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.createCategory(auth.accessToken, { name, kind, color });
    setName("");
    setColor("#5f8f7b");
    setKind("Expense");
    await refresh();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t("categories.eyebrow")}
        title={t("categories.title")}
        description={t("categories.description")}
      />

      <div className="split-grid">
        <SectionCard title={t("categories.addCategory")}>
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              {t("accounts.name")}
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              {t("categories.kind")}
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="Expense">{t("transactionType.Expense")}</option>
                <option value="Income">{t("transactionType.Income")}</option>
              </select>
            </label>
            <label>
              {t("categories.accentColor")}
              <input value={color} onChange={(event) => setColor(event.target.value)} type="color" />
            </label>
            <button className="primary-button" type="submit">
              {t("categories.addCategory")}
            </button>
          </form>
        </SectionCard>

        <SectionCard title={t("categories.availableCategories")}>
          <div className="chip-list">
            {categories.map((category) => (
              <div className="category-chip" key={category.id}>
                <span style={{ backgroundColor: category.color ?? "#5f8f7b" }} />
                <strong>{category.name}</strong>
                <small>{getCategoryKindLabel(category.kind, t)}</small>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
