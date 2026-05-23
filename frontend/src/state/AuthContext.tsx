import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { AuthPayload } from "../types";

type AuthContextValue = {
  auth: AuthPayload | null;
  isAuthenticated: boolean;
  login: (login: string, password: string, mode: "login" | "register", email?: string) => Promise<void>;
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

  const persist = (payload: AuthPayload | null) => {
    setAuth(payload);
    if (payload && isSessionValid(payload)) {
      getAuthStorage().setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      getAuthStorage().removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    apiClient.setAuthHandlers(() => auth, persist);
    return () => {
      apiClient.setAuthHandlers(null, null);
    };
  }, [auth]);

  useEffect(() => apiClient.onUnauthorized(() => persist(null)), []);

  const login = async (login: string, password: string, mode: "login" | "register", email?: string) => {
    const payload = mode === "register"
      ? await apiClient.register(login, password, email)
      : await apiClient.login(login, password);

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
