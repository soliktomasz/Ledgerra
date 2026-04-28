import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";

export function SettingsPage() {
  const { auth } = useAuth();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Settings"
        title="Deployment details"
        description="A lightweight space for instance identity while the API stays ready for future mobile clients."
      />

      <SectionCard title="Current session">
        <div className="table-list">
          <article className="table-row">
            <div>
              <strong>User email</strong>
              <p>Active local account</p>
            </div>
            <strong>{auth?.email ?? "Unknown"}</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>API model</strong>
              <p>Single-user JWT auth</p>
            </div>
            <strong>v1 ready</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>Mobile readiness</strong>
              <p>Same JSON API can back future iOS/Android clients.</p>
            </div>
            <strong>Prepared</strong>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
