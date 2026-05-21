import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "./client";

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