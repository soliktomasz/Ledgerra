export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Espanol" }
] as const;

export type SupportedLanguageCode = (typeof supportedLanguages)[number]["code"];

export function normalizeLanguageCode(value: string) {
  const normalized = value.trim().replace("_", "-");
  if (!normalized) {
    return "en";
  }

  const [primary, region] = normalized.split("-");
  if (!primary) {
    return "en";
  }

  return region ? `${primary.toLowerCase()}-${region.toUpperCase()}` : primary.toLowerCase();
}

export function getAppLanguageCode(languageCode: string): SupportedLanguageCode {
  const normalized = normalizeLanguageCode(languageCode);

  if (normalized.startsWith("pl")) {
    return "pl";
  }

  if (normalized.startsWith("de")) {
    return "de";
  }

  if (normalized.startsWith("es")) {
    return "es";
  }

  return "en";
}

export function getLocaleForLanguageCode(languageCode: string) {
  switch (getAppLanguageCode(languageCode)) {
    case "pl":
      return "pl-PL";
    case "de":
      return "de-DE";
    case "es":
      return "es-ES";
    default:
      return "en-US";
  }
}