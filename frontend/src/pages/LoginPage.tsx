import { FormEvent, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";

export function LoginPage() {
  const { login: authenticate } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginValue, setLoginValue] = useState("owner");
  const [password, setPassword] = useState("P@ssw0rd123!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await authenticate(loginValue, password, mode);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("login.unableToSignIn"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-hero">
        <span className="eyebrow">{t("login.heroEyebrow")}</span>
        <h1>{t("login.heroTitle")}</h1>
        <p>{t("login.heroDescription")}</p>
        <div className="login-preview" aria-label={t("login.workspacePreview")}>
          <div>
            <span>{t("login.previewMonthlyNet")}</span>
            <strong>$2,840</strong>
          </div>
          <div>
            <span>{t("login.previewBudgetRoom")}</span>
            <strong>$910</strong>
          </div>
          <div>
            <span>{t("login.previewAccounts")}</span>
            <strong>{t("login.previewAccountsValue")}</strong>
          </div>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-header">
          <span className="eyebrow">{t("login.secureAccess")}</span>
          <h2>{mode === "login" ? t("login.signInTitle") : t("login.createWorkspaceTitle")}</h2>
        </div>

        <div className="segmented-control">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            {t("login.signIn")}
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            {t("login.createAccount")}
          </button>
        </div>

        <label>
          {t("login.email")}
          <input value={loginValue} onChange={(event) => setLoginValue(event.target.value)} type="text" required />
        </label>

        <label>
          {t("login.password")}
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>

        {error ? <p className="error-banner">{error}</p> : null}

        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? t("login.working") : mode === "login" ? t("login.enterLedgerra") : t("login.startTracking")}
        </button>
      </form>
    </div>
  );
}
