export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Espanol" }
] as const;

export type SupportedLanguageCode = (typeof supportedLanguages)[number]["code"];

export function normalizeLanguageCode(value: string) {
  const normalized = value.trim().replace(/_/g, "-");
  if (!normalized) {
    return "en";
  }

  const segments = normalized.split("-").filter(Boolean);
  if (segments.length === 0) {
    return "en";
  }

  return segments
    .map((segment, index) => {
      if (index === 0) {
        return segment.toLowerCase();
      }

      if (segment.length === 4) {
        return `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}`;
      }

      if (segment.length <= 3) {
        return segment.toUpperCase();
      }

      return segment.toLowerCase();
    })
    .join("-");
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