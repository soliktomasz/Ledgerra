import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, resolveApiUrl } from "./client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("resolveApiUrl", () => {
  it("keeps same-origin api paths when no base url is configured", () => {
    expect(resolveApiUrl("", "/api/auth/login")).toBe("/api/auth/login");
  });

  it("joins an origin-only base url with api-prefixed request paths", () => {
    expect(resolveApiUrl("http://localhost:5027", "/api/auth/login")).toBe("http://localhost:5027/api/auth/login");
  });

  it("avoids duplicating the api prefix when the base url already ends with /api", () => {
    expect(resolveApiUrl("/api", "/api/auth/login")).toBe("/api/auth/login");
    expect(resolveApiUrl("https://ledgerra.example/api/", "/api/auth/login")).toBe(
      "https://ledgerra.example/api/auth/login"
    );
  });
});

describe("apiClient", () => {
  it("omits email from register requests when no email is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        userId: "user-1",
        login: "owner",
        email: "",
        accessToken: "token",
        refreshToken: "refresh",
        expiresAtUtc: "2999-01-01T00:00:00Z"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.register("owner", "P@ssw0rd123!");

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      login: "owner",
      password: "P@ssw0rd123!"
    });
  });

  it("refreshes once and retries concurrent unauthorized requests", async () => {
    const persist = vi.fn();
    apiClient.setAuthHandlers(
      () => ({
        userId: "user-1",
        login: "owner",
        email: "owner@test.local",
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        expiresAtUtc: "2999-01-01T00:00:00Z"
      }),
      persist
    );

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, clone: () => ({ json: async () => ({ title: "expired" }) }), text: async () => "expired" })
      .mockResolvedValueOnce({ ok: false, status: 401, clone: () => ({ json: async () => ({ title: "expired" }) }), text: async () => "expired" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: "user-1", login: "owner", email: "owner@test.local", accessToken: "fresh-token", refreshToken: "rotated", expiresAtUtc: "2999-01-02T00:00:00Z"
        })
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ value: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      apiClient.getDashboard("expired-token", "2026-05"),
      apiClient.getAccounts("expired-token")
    ]);

    const refreshCalls = fetchMock.mock.calls.filter((call) => (call[0] as string).includes("/api/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "fresh-token", refreshToken: "rotated" }));
  });

  it("notifies unauthorized and does not retry loop when refresh fails", async () => {
    const persist = vi.fn();
    const onUnauthorized = vi.fn();
    apiClient.setAuthHandlers(
      () => ({
        userId: "user-1",
        login: "owner",
        email: "owner@test.local",
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        expiresAtUtc: "2999-01-01T00:00:00Z"
      }),
      persist
    );
    const unsubscribe = apiClient.onUnauthorized(onUnauthorized);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, clone: () => ({ json: async () => ({ title: "expired" }) }), text: async () => "expired" })
      .mockResolvedValueOnce({ ok: false, status: 401, clone: () => ({ json: async () => ({ title: "invalid refresh" }) }), text: async () => "invalid refresh" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.getAccounts("expired-token")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenCalledWith(null);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
