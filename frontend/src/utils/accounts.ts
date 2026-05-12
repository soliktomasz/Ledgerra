import type { Account } from "../types";

export const ACCOUNT_GROUP_ORDER = [
  "Checking", "Savings", "Credit", "Cash", "Investment", "Joint"
] as const;

export type AccountGroupType = (typeof ACCOUNT_GROUP_ORDER)[number];

export type AccountGroup = {
  type: AccountGroupType;
  accounts: Account[];
  totalBalance: number;
  currencyCode: string | null;
};

export function groupAccountsByType(accounts: Account[]): AccountGroup[] {
  return ACCOUNT_GROUP_ORDER
    .map((type) => {
      const matches = accounts.filter((a) => a.type === type);
      if (matches.length === 0) {
        return null;
      }
      const totalBalance = matches.reduce((sum, a) => sum + a.currentBalance, 0);
      const currencies = new Set(matches.map((a) => a.currencyCode));
      const currencyCode = currencies.size === 1 ? matches[0].currencyCode : null;
      return { type, accounts: matches, totalBalance, currencyCode };
    })
    .filter((g): g is AccountGroup => g !== null);
}
