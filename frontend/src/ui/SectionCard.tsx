import type { ReactNode } from "react";

export function SectionCard({
  title,
  icon,
  actions,
  children
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-header">
        <div className="section-title">
          {icon ? <div className="section-title-icon">{icon}</div> : null}
          <h2>{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
