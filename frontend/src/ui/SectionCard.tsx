import type { ReactNode } from "react";

export function SectionCard({
  title,
  icon,
  actions,
  children,
  hideHeader = false
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  hideHeader?: boolean;
}) {
  return (
    <section className="section-card">
      {hideHeader ? null : (
        <div className="section-header">
          <div className="section-title">
            {icon ? <div className="section-title-icon">{icon}</div> : null}
            <h2>{title}</h2>
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
