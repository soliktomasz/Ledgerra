import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (theme: ThemePreference) => void;
};

const storageKey = "ledgerra:theme";
const mediaQuery = "(prefers-color-scheme: dark)";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia(mediaQuery).matches ? "dark" : "light";
}

function resolveInitialThemePreference(initialThemePreference?: ThemePreference) {
  if (initialThemePreference) {
    return initialThemePreference;
  }

  if (typeof window === "undefined") {
    return "system";
  }

  const storedThemePreference = window.localStorage.getItem(storageKey);
  return isThemePreference(storedThemePreference) ? storedThemePreference : "system";
}

const defaultContextValue: ThemeContextValue = {
  themePreference: "system",
  resolvedTheme: "light",
  setThemePreference: () => undefined
};

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

export function ThemeProvider({
  children,
  initialThemePreference
}: {
  children: ReactNode;
  initialThemePreference?: ThemePreference;
}) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => resolveInitialThemePreference(initialThemePreference));
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const media = window.matchMedia(mediaQuery);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = resolvedTheme;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, themePreference);
    }
  }, [resolvedTheme, themePreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference
    }),
    [resolvedTheme, themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
