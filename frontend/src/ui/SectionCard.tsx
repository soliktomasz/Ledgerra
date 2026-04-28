import type { ReactNode } from "react";

export function SectionCard({
  title,
  actions,
  children
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-header">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
