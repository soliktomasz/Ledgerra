import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  tone = "neutral",
  detail,
  icon
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <section className={`metric-card metric-card--${tone}`}>
      <div className="metric-card-header">
        <span>{label}</span>
        {icon ? <div className="metric-card-icon">{icon}</div> : null}
      </div>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </section>
  );
}
