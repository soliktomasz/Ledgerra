import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import type { SavingsGoal } from "../types";
import { formatCurrency } from "../utils/format";

export function GoalsPage() {
  const { auth } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("0");

  const refresh = async () => {
    if (!auth?.accessToken) return;
    setGoals(await apiClient.getSavingsGoals(auth.accessToken));
  };
  useEffect(() => { void refresh(); }, [auth?.accessToken]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) return;
    await apiClient.createSavingsGoal(auth.accessToken, { name, targetAmount: Number(targetAmount) });
    setName("");
    setTargetAmount("0");
    await refresh();
  };

  return <div className="page-stack">
    <PageHeader eyebrow="Plan" title="Savings goals" description="Track progress for transfers linked to each goal." />
    <SectionCard title="Create goal">
      <form onSubmit={onSubmit} className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name" required />
        <input type="number" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
        <button className="primary-button" type="submit">Create</button>
      </form>
    </SectionCard>
    <SectionCard title="Goals">
      {goals.map((goal) => <div key={goal.id} style={{ marginBottom: 12 }}>
        <strong>{goal.name}</strong> — {formatCurrency(goal.savedAmount, "USD")} / {formatCurrency(goal.targetAmount, "USD")}
        <progress max={100} value={goal.progressPercent} style={{ width: "100%" }} />
      </div>)}
    </SectionCard>
  </div>;
}
