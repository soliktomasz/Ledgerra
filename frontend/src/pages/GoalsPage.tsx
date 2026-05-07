import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import type { SavingsGoal } from "../types";
import { formatCurrency } from "../utils/format";

export function GoalsPage() {
  const { auth } = useAuth();
  const { profile } = useLedgerraData({ profile: true });
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const currencyCode = profile?.preferredCurrencyCode ?? "USD";

  const refresh = async () => {
    if (!auth?.accessToken) return;
    try {
      setGoals(await apiClient.getSavingsGoals(auth.accessToken));
      setError(null);
    } catch (err) {
      console.error("Failed to load savings goals:", err);
      setError("Failed to load savings goals. Please try again.");
    }
  };
  useEffect(() => { void refresh(); }, [auth?.accessToken]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) return;
    try {
      await apiClient.createSavingsGoal(auth.accessToken, { name, targetAmount: Number(targetAmount) });
      setName("");
      setTargetAmount("0");
      setError(null);
      await refresh();
    } catch (err) {
      console.error("Failed to create savings goal:", err);
      setError("Failed to create savings goal. Please try again.");
    }
  };

  return <div className="page-stack">
    <PageHeader eyebrow="Plan" title="Savings goals" description="Track progress for transfers linked to each goal." />
    {error && <div style={{ padding: "12px", backgroundColor: "#fee", color: "#c00", borderRadius: "4px", marginBottom: "12px" }}>{error}</div>}
    <SectionCard title="Create goal">
      <form onSubmit={onSubmit} className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name" required />
        <input type="number" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
        <button className="primary-button" type="submit">Create</button>
      </form>
    </SectionCard>
    <SectionCard title="Goals">
      {goals.map((goal) => <div key={goal.id} style={{ marginBottom: 12 }}>
        <strong>{goal.name}</strong> — {formatCurrency(goal.savedAmount, currencyCode)} / {formatCurrency(goal.targetAmount, currencyCode)}
        <progress max={100} value={goal.progressPercent} style={{ width: "100%" }} />
      </div>)}
    </SectionCard>
  </div>;
}
