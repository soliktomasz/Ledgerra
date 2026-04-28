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
        <span className="eyebrow">Ledgerra finance console</span>
        <h1>Clean visibility for every account, budget, and transaction.</h1>
        <p>
          Ledgerra brings day-to-day money tracking into one focused workspace for
          self-hosted households and future mobile clients.
        </p>
        <div className="login-preview" aria-label="Ledgerra workspace preview">
          <div>
            <span>Monthly net</span>
            <strong>$2,840</strong>
          </div>
          <div>
            <span>Budget room</span>
            <strong>$910</strong>
          </div>
          <div>
            <span>Accounts</span>
            <strong>5 active</strong>
          </div>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-header">
          <span className="eyebrow">Secure access</span>
          <h2>{mode === "login" ? "Sign in to Ledgerra" : "Create your workspace"}</h2>
        </div>

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
