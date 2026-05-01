import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "./format";

describe("formatCurrency", () => {
  it("renders USD amounts consistently", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("renders PLN amounts with Polish locale rules", () => {
    const formatted = formatCurrency(1234.5, "PLN", "pl");

    expect(formatted).toMatch(/1.?234,50/);
    expect(formatted).toContain("zł");
  });

  it("renders EUR amounts with German locale rules", () => {
    const formatted = formatCurrency(1234.5, "EUR", "de");

    expect(formatted).toMatch(/1.?234,50/);
    expect(formatted).toContain("€");
  });

  it("renders EUR amounts with Spanish locale rules", () => {
    const formatted = formatCurrency(1234.5, "EUR", "es");

    expect(formatted).toMatch(/1234,50|1.?234,50/);
    expect(formatted).toContain("€");
  });
});

describe("formatDate", () => {
  it("renders Polish dates with the selected locale", () => {
    expect(formatDate("2026-05-01T00:00:00Z", "pl")).toContain("2026");
  });
});
