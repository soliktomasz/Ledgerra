import { FormEvent, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";

export function CategoriesPage() {
  const { auth } = useAuth();
  const { categories, refresh } = useLedgerraData();
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
        eyebrow="Categories"
        title="Shape the language of your money"
        description="Keep categories intentional so budgets and reports stay readable over time."
      />

      <div className="split-grid">
        <SectionCard title="Add category">
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Kind
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option>Expense</option>
                <option>Income</option>
              </select>
            </label>
            <label>
              Accent color
              <input value={color} onChange={(event) => setColor(event.target.value)} type="color" />
            </label>
            <button className="primary-button" type="submit">
              Add category
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Available categories">
          <div className="chip-list">
            {categories.map((category) => (
              <div className="category-chip" key={category.id}>
                <span style={{ backgroundColor: category.color ?? "#5f8f7b" }} />
                <strong>{category.name}</strong>
                <small>{category.kind}</small>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
