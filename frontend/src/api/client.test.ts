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
});
