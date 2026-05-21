import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../api/client", () => ({
  apiClient: {
    onUnauthorized: () => () => undefined,
    login: vi.fn(),
    register: vi.fn()
  }
}));

function AuthProbe() {
  const { isAuthenticated } = useAuth();
  return <div>{isAuthenticated ? "authenticated" : "anonymous"}</div>;
}

describe("AuthProvider", () => {
  it("restores a valid persisted session from localStorage", async () => {
    window.localStorage.setItem("ledgerra.auth", JSON.stringify({
      userId: "user-1",
      email: "owner@ledgerra.local",
      accessToken: "token",
      refreshToken: "refresh",
      expiresAtUtc: "2999-01-01T00:00:00Z"
    }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("authenticated")).toBeInTheDocument());
  });

  it("clears expired persisted sessions and falls back to login state", async () => {
    window.localStorage.setItem("ledgerra.auth", JSON.stringify({
      userId: "user-1",
      email: "owner@ledgerra.local",
      accessToken: "token",
      refreshToken: "refresh",
      expiresAtUtc: "2000-01-01T00:00:00Z"
    }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(window.localStorage.getItem("ledgerra.auth")).toBeNull();
  });
});
