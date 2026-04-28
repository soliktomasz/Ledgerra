import { describe, expect, it } from "vitest";
import { normalizeCurrencyCode, supportedCurrencies } from "./currency";

describe("currency helpers", () => {
  it("normalizes currency codes for API payloads", () => {
    expect(normalizeCurrencyCode(" eur ")).toBe("EUR");
  });

  it("includes the default and common account currencies", () => {
    expect(supportedCurrencies).toEqual(
      expect.arrayContaining([
        { code: "USD", label: "USD - US Dollar" },
        { code: "EUR", label: "EUR - Euro" },
        { code: "PLN", label: "PLN - Polish Zloty" }
      ])
    );
  });
});
