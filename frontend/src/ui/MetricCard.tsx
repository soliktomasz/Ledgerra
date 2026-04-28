export function MetricCard({
  label,
  value,
  tone = "neutral",
  detail
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  detail?: string;
}) {
  return (
    <section className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </section>
  );
}
