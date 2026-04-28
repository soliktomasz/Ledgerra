export const supportedCurrencies = [
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "PLN", label: "PLN - Polish Zloty" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "CHF", label: "CHF - Swiss Franc" },
  { code: "JPY", label: "JPY - Japanese Yen" }
] as const;

export function normalizeCurrencyCode(value: string) {
  return value.trim().toUpperCase();
}
