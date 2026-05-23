import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const onUnauthorizedMock = vi.fn();
const setAuthHandlersMock = vi.fn();

vi.mock("../api/client", () => ({
  apiClient: {
    onUnauthorized: onUnauthorizedMock,
    setAuthHandlers: setAuthHandlersMock,
    login: vi.fn(),
    register: vi.fn()
  }
}));

function AuthProbe() {
  const { isAuthenticated } = useAuth();
  return <div>{isAuthenticated ? "authenticated" : "anonymous"}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    onUnauthorizedMock.mockReset();
    setAuthHandlersMock.mockReset();
    onUnauthorizedMock.mockReturnValue(() => undefined);
  });

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
    expect(window.localStorage.getItem("ledgerra.auth")).not.toBeNull();
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

  it("registers auth handlers and persists rotated auth payloads", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(setAuthHandlersMock).toHaveBeenCalled());
    const persist = setAuthHandlersMock.mock.calls.at(-1)?.[1] as ((payload: unknown) => void);
    persist({
      userId: "user-1",
      login: "owner",
      email: "owner@ledgerra.local",
      accessToken: "new-token",
      refreshToken: "new-refresh",
      expiresAtUtc: "2999-01-01T00:00:00Z"
    });

    await waitFor(() => expect(screen.getByText("authenticated")).toBeInTheDocument());
    expect(window.localStorage.getItem("ledgerra.auth")).toContain("new-refresh");
  });
});
