import { describe, expect, it } from "vitest";
import type { Account, Transaction } from "../types";
import { groupAccountsByType, ACCOUNT_GROUP_ORDER, computeBalanceSeries, filterAccounts, computeNetWorth, computeWeekChange, computeMonthInflows, computeMonthOutflows } from "./accounts";

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

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? "t",
    accountId: overrides.accountId ?? "a",
    amount: overrides.amount ?? 0,
    type: overrides.type ?? "Expense",
    occurredOnUtc: overrides.occurredOnUtc ?? "2026-05-10T00:00:00Z",
    note: null,
    ...overrides
  };
}

describe("computeBalanceSeries", () => {
  it("returns one point per day in the range with last point equal to currentBalance when there are no transactions", () => {
    const series = computeBalanceSeries({
      currentBalance: 1000,
      transactions: [],
      rangeDays: 30,
      now: new Date("2026-05-12T00:00:00Z")
    });
    expect(series).toHaveLength(31);
    expect(series[series.length - 1].balance).toBe(1000);
    expect(series[0].balance).toBe(1000);
  });

  it("rolls back daily balances by signed transaction amounts", () => {
    const series = computeBalanceSeries({
      currentBalance: 1000,
      transactions: [
        makeTransaction({ amount: 200, type: "Income", occurredOnUtc: "2026-05-10T12:00:00Z" }),
        makeTransaction({ amount: 50, type: "Expense", occurredOnUtc: "2026-05-11T12:00:00Z" })
      ],
      rangeDays: 5,
      now: new Date("2026-05-12T00:00:00Z")
    });

    const lastPoint = series[series.length - 1];
    expect(lastPoint.balance).toBe(1000);
    const beforeMay10 = series.find((p) => p.date === "2026-05-09");
    expect(beforeMay10?.balance).toBe(850);
  });
});

describe("filterAccounts", () => {
  it("returns all accounts when query is empty", () => {
    const accounts = [makeAccount({ id: "a", name: "mBank" })];
    expect(filterAccounts(accounts, "")).toEqual(accounts);
  });

  it("matches by name, institutionName, and accountNumberMasked, case-insensitively", () => {
    const accounts = [
      makeAccount({ id: "1", name: "mBank Konto", institutionName: "mBank" }),
      makeAccount({ id: "2", name: "Revolut", institutionName: "Revolut", accountNumberMasked: "GB ** 1042" }),
      makeAccount({ id: "3", name: "Kasa", institutionName: "Gotówka" })
    ];
    expect(filterAccounts(accounts, "mbank").map((a) => a.id)).toEqual(["1"]);
    expect(filterAccounts(accounts, "revolut").map((a) => a.id)).toEqual(["2"]);
    expect(filterAccounts(accounts, "1042").map((a) => a.id)).toEqual(["2"]);
    expect(filterAccounts(accounts, "GotÓwka").map((a) => a.id)).toEqual(["3"]);
  });
});

describe("computeNetWorth", () => {
  it("sums balances when all accounts share a currency", () => {
    const accounts = [
      makeAccount({ id: "a", currentBalance: 100, currencyCode: "PLN" }),
      makeAccount({ id: "b", currentBalance: 250, currencyCode: "PLN" })
    ];
    expect(computeNetWorth(accounts)).toEqual({ value: 350, currencyCode: "PLN" });
  });

  it("returns null currency on mixed currencies", () => {
    const accounts = [
      makeAccount({ id: "a", currentBalance: 100, currencyCode: "PLN" }),
      makeAccount({ id: "b", currentBalance: 250, currencyCode: "EUR" })
    ];
    expect(computeNetWorth(accounts)).toEqual({ value: 350, currencyCode: null });
  });

  it("returns zero with null currency when empty", () => {
    expect(computeNetWorth([])).toEqual({ value: 0, currencyCode: null });
  });
});

describe("computeWeekChange / computeMonthInflows / computeMonthOutflows", () => {
  const now = new Date("2026-05-12T00:00:00Z");

  it("computeWeekChange sums signed amounts in the last 7 days", () => {
    const txs = [
      makeTransaction({ id: "1", amount: 100, type: "Income", occurredOnUtc: "2026-05-10T00:00:00Z" }),
      makeTransaction({ id: "2", amount: 30, type: "Expense", occurredOnUtc: "2026-05-11T00:00:00Z" }),
      makeTransaction({ id: "3", amount: 999, type: "Expense", occurredOnUtc: "2026-04-01T00:00:00Z" })
    ];
    expect(computeWeekChange(txs, now)).toBe(70);
  });

  it("computeMonthInflows sums Income+TransferIn for the selected month (YYYY-MM)", () => {
    const txs = [
      makeTransaction({ id: "1", amount: 1200, type: "Income", occurredOnUtc: "2026-05-07T00:00:00Z" }),
      makeTransaction({ id: "2", amount: 50, type: "TransferIn", occurredOnUtc: "2026-05-15T00:00:00Z" }),
      makeTransaction({ id: "3", amount: 999, type: "Income", occurredOnUtc: "2026-04-30T00:00:00Z" }),
      makeTransaction({ id: "4", amount: 50, type: "Expense", occurredOnUtc: "2026-05-08T00:00:00Z" })
    ];
    expect(computeMonthInflows(txs, "2026-05")).toBe(1250);
  });

  it("computeMonthOutflows sums Expense+TransferOut for the selected month (YYYY-MM)", () => {
    const txs = [
      makeTransaction({ id: "1", amount: 142, type: "Expense", occurredOnUtc: "2026-05-09T00:00:00Z" }),
      makeTransaction({ id: "2", amount: 100, type: "TransferOut", occurredOnUtc: "2026-05-20T00:00:00Z" }),
      makeTransaction({ id: "3", amount: 999, type: "Expense", occurredOnUtc: "2026-04-15T00:00:00Z" }),
      makeTransaction({ id: "4", amount: 1200, type: "Income", occurredOnUtc: "2026-05-07T00:00:00Z" })
    ];
    expect(computeMonthOutflows(txs, "2026-05")).toBe(242);
  });
});
