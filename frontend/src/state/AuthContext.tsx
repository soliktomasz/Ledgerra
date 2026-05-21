import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { AuthPayload } from "../types";

type AuthContextValue = {
  auth: AuthPayload | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, mode: "login" | "register") => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "ledgerra.auth";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getAuthStorage() {
  return window.localStorage;
}

function isSessionValid(payload: AuthPayload): boolean {
  const expiresAt = Date.parse(payload.expiresAtUtc);
  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt > Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthPayload | null>(null);

  useEffect(() => {
    const raw = getAuthStorage().getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const payload = JSON.parse(raw) as AuthPayload;
      if (isSessionValid(payload)) {
        setAuth(payload);
      } else {
        getAuthStorage().removeItem(STORAGE_KEY);
      }
    } catch {
      getAuthStorage().removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => apiClient.onUnauthorized(() => persist(null)), []);

  const persist = (payload: AuthPayload | null) => {
    setAuth(payload);
    if (payload && isSessionValid(payload)) {
      getAuthStorage().setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      getAuthStorage().removeItem(STORAGE_KEY);
    }
  };

  const login = async (email: string, password: string, mode: "login" | "register") => {
    const payload = mode === "register"
      ? await apiClient.register(email, password)
      : await apiClient.login(email, password);

    persist(payload);
  };

  const logout = () => persist(null);

  return (
    <AuthContext.Provider
      value={{
        auth,
        isAuthenticated: Boolean(auth?.accessToken),
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
