import { getLocaleForLanguageCode } from "./language";

let activeLanguageCode = "en";

export function setFormattingLanguageCode(languageCode: string) {
  activeLanguageCode = languageCode;
}

export function formatCurrency(value: number, currencyCode = "USD", languageCode = activeLanguageCode) {
  return new Intl.NumberFormat(getLocaleForLanguageCode(languageCode), {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(value: string, languageCode = activeLanguageCode) {
  return new Intl.DateTimeFormat(getLocaleForLanguageCode(languageCode), {
    dateStyle: "medium"
  }).format(new Date(value));
}
