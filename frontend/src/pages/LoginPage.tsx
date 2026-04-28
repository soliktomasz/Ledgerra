import { FormEvent, useState } from "react";
import { useAuth } from "../state/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("owner@ledgerra.local");
  const [password, setPassword] = useState("P@ssw0rd123!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await login(email, password, mode);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-hero">
        <span className="eyebrow">Self-hosted budgeting</span>
        <h1>Steady planning for the money you actually live with.</h1>
        <p>
          Ledgerra brings accounts, spending, and category budgets into one calm dashboard
          built for homelabs, shared households, and future mobile clients.
        </p>
        <ul className="hero-points">
          <li>Track income and expenses across separate accounts.</li>
          <li>Set monthly category budgets and watch remaining room update live.</li>
          <li>Run it yourself with a clean API that future mobile apps can reuse.</li>
        </ul>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="segmented-control">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Sign in
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Create account
          </button>
        </div>

        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>

        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>

        {error ? <p className="error-banner">{error}</p> : null}

        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Working..." : mode === "login" ? "Enter Ledgerra" : "Start tracking"}
        </button>
      </form>
    </div>
  );
}
