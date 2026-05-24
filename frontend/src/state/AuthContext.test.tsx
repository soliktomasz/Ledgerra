import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const { onUnauthorizedMock, setAuthHandlersMock } = vi.hoisted(() => ({
  onUnauthorizedMock: vi.fn(),
  setAuthHandlersMock: vi.fn()
}));

vi.mock("../api/client", () => ({
  apiClient: {
    onUnauthorized: onUnauthorizedMock,
    setAuthHandlers: setAuthHandlersMock,
    login: vi.fn(),
    refresh: vi.fn(),
    register: vi.fn()
  }
}));

import { apiClient } from "../api/client";

function AuthProbe() {
  const { isAuthenticated } = useAuth();
  return <div>{isAuthenticated ? "authenticated" : "anonymous"}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    onUnauthorizedMock.mockReset();
    setAuthHandlersMock.mockReset();
    vi.mocked(apiClient.refresh).mockReset();
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

  it("refreshes expired persisted sessions when a refresh token is available", async () => {
    vi.mocked(apiClient.refresh).mockResolvedValue({
      userId: "user-1",
      login: "owner",
      email: "owner@ledgerra.local",
      accessToken: "fresh-token",
      refreshToken: "fresh-refresh",
      expiresAtUtc: "2999-01-01T00:00:00Z"
    });
    window.localStorage.setItem("ledgerra.auth", JSON.stringify({
      userId: "user-1",
      login: "owner",
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

    await waitFor(() => expect(screen.getByText("authenticated")).toBeInTheDocument());
    expect(apiClient.refresh).toHaveBeenCalledWith("refresh");
    expect(window.localStorage.getItem("ledgerra.auth")).toContain("fresh-refresh");
  });

  it("clears expired persisted sessions when refresh fails", async () => {
    vi.mocked(apiClient.refresh).mockRejectedValue(new Error("invalid refresh"));
    window.localStorage.setItem("ledgerra.auth", JSON.stringify({
      userId: "user-1",
      login: "owner",
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
