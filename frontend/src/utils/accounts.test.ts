import { describe, expect, it } from "vitest";
import type { Account } from "../types";
import { groupAccountsByType, ACCOUNT_GROUP_ORDER } from "./accounts";

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: overrides.id ?? "a",
    name: "X",
    type: "Checking",
    currencyCode: "PLN",
    openingBalance: 0,
    currentBalance: 0,
    isActive: true,
    iconKind: "Bank",
    ...overrides
  };
}

describe("groupAccountsByType", () => {
  it("orders groups Checking → Savings → Credit → Cash → Investment → Joint", () => {
    const accounts = [
      makeAccount({ id: "joint", type: "Joint" }),
      makeAccount({ id: "inv", type: "Investment" }),
      makeAccount({ id: "chk", type: "Checking" }),
      makeAccount({ id: "sav", type: "Savings" }),
      makeAccount({ id: "crd", type: "Credit" }),
      makeAccount({ id: "csh", type: "Cash" })
    ];

    const groups = groupAccountsByType(accounts);
    expect(groups.map((g) => g.type)).toEqual(ACCOUNT_GROUP_ORDER);
  });

  it("omits empty groups", () => {
    const groups = groupAccountsByType([makeAccount({ type: "Cash" })]);
    expect(groups.map((g) => g.type)).toEqual(["Cash"]);
  });

  it("computes group total balance and common currency", () => {
    const groups = groupAccountsByType([
      makeAccount({ id: "1", type: "Checking", currentBalance: 100, currencyCode: "PLN" }),
      makeAccount({ id: "2", type: "Checking", currentBalance: 50, currencyCode: "PLN" })
    ]);
    expect(groups[0].totalBalance).toBe(150);
    expect(groups[0].currencyCode).toBe("PLN");
  });

  it("returns null currency when group mixes currencies", () => {
    const groups = groupAccountsByType([
      makeAccount({ id: "1", type: "Checking", currencyCode: "PLN" }),
      makeAccount({ id: "2", type: "Checking", currencyCode: "EUR" })
    ]);
    expect(groups[0].currencyCode).toBeNull();
  });
});
