import { describe, expect, it } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("renders USD amounts consistently", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });
});
