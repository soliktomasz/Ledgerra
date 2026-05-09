import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type AccentColor = "teal" | "blue" | "gold" | "purple" | "coral";

export const accentPresets: { id: AccentColor; swatch: string }[] = [
  { id: "teal", swatch: "#34D9A8" },
  { id: "blue", swatch: "#7AB8F5" },
  { id: "gold", swatch: "#F5C56B" },
  { id: "purple", swatch: "#A78BFA" },
  { id: "coral", swatch: "#F07A6A" }
];

const accentVariables: Record<AccentColor, { light: Record<string, string>; dark: Record<string, string> }> = {
  teal: {
    light: {
      "--accent": "#0f766e",
      "--accent-strong": "#0f5f59",
      "--accent-ink": "#ffffff",
      "--accent-soft": "#ecfdf5",
      "--accent-border": "#99f6e4",
      "--accent-gradient-end": "#22c55e",
      "--accent-area-fill": "rgba(15, 118, 110, 0.08)",
      "--accent-ring": "rgba(15, 118, 110, 0.12)",
      "--accent-outline": "rgba(15, 118, 110, 0.2)",
      "--accent-tint": "rgba(15, 118, 110, 0.08)"
    },
    dark: {
      "--accent": "#34d9a8",
      "--accent-strong": "#7df2cf",
      "--accent-ink": "#062018",
      "--accent-soft": "rgba(52, 217, 168, 0.14)",
      "--accent-border": "rgba(52, 217, 168, 0.32)",
      "--accent-gradient-end": "#28c394",
      "--accent-area-fill": "rgba(52, 217, 168, 0.18)",
      "--accent-ring": "rgba(52, 217, 168, 0.2)",
      "--accent-outline": "rgba(52, 217, 168, 0.3)",
      "--accent-tint": "rgba(52, 217, 168, 0.14)"
    }
  },
  blue: {
    light: {
      "--accent": "#2563eb",
      "--accent-strong": "#1e40af",
      "--accent-ink": "#ffffff",
      "--accent-soft": "#eff6ff",
      "--accent-border": "#93c5fd",
      "--accent-gradient-end": "#3b82f6",
      "--accent-area-fill": "rgba(37, 99, 235, 0.08)",
      "--accent-ring": "rgba(37, 99, 235, 0.12)",
      "--accent-outline": "rgba(37, 99, 235, 0.2)",
      "--accent-tint": "rgba(37, 99, 235, 0.08)"
    },
    dark: {
      "--accent": "#7AB8F5",
      "--accent-strong": "#a5d0fc",
      "--accent-ink": "#0a1929",
      "--accent-soft": "rgba(122, 184, 245, 0.14)",
      "--accent-border": "rgba(122, 184, 245, 0.32)",
      "--accent-gradient-end": "#60a5fa",
      "--accent-area-fill": "rgba(122, 184, 245, 0.18)",
      "--accent-ring": "rgba(122, 184, 245, 0.2)",
      "--accent-outline": "rgba(122, 184, 245, 0.3)",
      "--accent-tint": "rgba(122, 184, 245, 0.14)"
    }
  },
  gold: {
    light: {
      "--accent": "#b45309",
      "--accent-strong": "#92400e",
      "--accent-ink": "#ffffff",
      "--accent-soft": "#fffbeb",
      "--accent-border": "#fde68a",
      "--accent-gradient-end": "#d97706",
      "--accent-area-fill": "rgba(180, 83, 9, 0.08)",
      "--accent-ring": "rgba(180, 83, 9, 0.12)",
      "--accent-outline": "rgba(180, 83, 9, 0.2)",
      "--accent-tint": "rgba(180, 83, 9, 0.08)"
    },
    dark: {
      "--accent": "#F5C56B",
      "--accent-strong": "#fbd88d",
      "--accent-ink": "#1c1305",
      "--accent-soft": "rgba(245, 197, 107, 0.14)",
      "--accent-border": "rgba(245, 197, 107, 0.32)",
      "--accent-gradient-end": "#fbbf24",
      "--accent-area-fill": "rgba(245, 197, 107, 0.18)",
      "--accent-ring": "rgba(245, 197, 107, 0.2)",
      "--accent-outline": "rgba(245, 197, 107, 0.3)",
      "--accent-tint": "rgba(245, 197, 107, 0.14)"
    }
  },
  purple: {
    light: {
      "--accent": "#7c3aed",
      "--accent-strong": "#6d28d9",
      "--accent-ink": "#ffffff",
      "--accent-soft": "#f5f3ff",
      "--accent-border": "#c4b5fd",
      "--accent-gradient-end": "#8b5cf6",
      "--accent-area-fill": "rgba(124, 58, 237, 0.08)",
      "--accent-ring": "rgba(124, 58, 237, 0.12)",
      "--accent-outline": "rgba(124, 58, 237, 0.2)",
      "--accent-tint": "rgba(124, 58, 237, 0.08)"
    },
    dark: {
      "--accent": "#A78BFA",
      "--accent-strong": "#c4b5fd",
      "--accent-ink": "#0f051f",
      "--accent-soft": "rgba(167, 139, 250, 0.14)",
      "--accent-border": "rgba(167, 139, 250, 0.32)",
      "--accent-gradient-end": "#8b5cf6",
      "--accent-area-fill": "rgba(167, 139, 250, 0.18)",
      "--accent-ring": "rgba(167, 139, 250, 0.2)",
      "--accent-outline": "rgba(167, 139, 250, 0.3)",
      "--accent-tint": "rgba(167, 139, 250, 0.14)"
    }
  },
  coral: {
    light: {
      "--accent": "#dc2626",
      "--accent-strong": "#b91c1c",
      "--accent-ink": "#ffffff",
      "--accent-soft": "#fef2f2",
      "--accent-border": "#fecaca",
      "--accent-gradient-end": "#ef4444",
      "--accent-area-fill": "rgba(220, 38, 38, 0.08)",
      "--accent-ring": "rgba(220, 38, 38, 0.12)",
      "--accent-outline": "rgba(220, 38, 38, 0.2)",
      "--accent-tint": "rgba(220, 38, 38, 0.08)"
    },
    dark: {
      "--accent": "#F07A6A",
      "--accent-strong": "#f5a396",
      "--accent-ink": "#1f0806",
      "--accent-soft": "rgba(240, 122, 106, 0.14)",
      "--accent-border": "rgba(240, 122, 106, 0.32)",
      "--accent-gradient-end": "#f87171",
      "--accent-area-fill": "rgba(240, 122, 106, 0.18)",
      "--accent-ring": "rgba(240, 122, 106, 0.2)",
      "--accent-outline": "rgba(240, 122, 106, 0.3)",
      "--accent-tint": "rgba(240, 122, 106, 0.14)"
    }
  }
};

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  accentColor: AccentColor;
  setThemePreference: (theme: ThemePreference) => void;
  setAccentColor: (accent: AccentColor) => void;
};

const storageKey = "ledgerra:theme";
const accentStorageKey = "ledgerra:accent";
const mediaQuery = "(prefers-color-scheme: dark)";

function isAccentColor(value: string | null): value is AccentColor {
  return value === "teal" || value === "blue" || value === "gold" || value === "purple" || value === "coral";
}

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
  accentColor: "teal",
  setThemePreference: () => undefined,
  setAccentColor: () => undefined
};

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

function applyAccentVariables(accent: AccentColor, theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const vars = accentVariables[accent][theme];
  const root = document.documentElement;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
}

export function ThemeProvider({
  children,
  initialThemePreference
}: {
  children: ReactNode;
  initialThemePreference?: ThemePreference;
}) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => resolveInitialThemePreference(initialThemePreference));
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window === "undefined") return "teal";
    const stored = window.localStorage.getItem(accentStorageKey);
    return isAccentColor(stored) ? stored : "teal";
  });

  const setAccentColor = (accent: AccentColor) => {
    setAccentColorState(accent);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(accentStorageKey, accent);
    }
  };

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

  useEffect(() => {
    applyAccentVariables(accentColor, resolvedTheme);
  }, [accentColor, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      accentColor,
      setThemePreference,
      setAccentColor
    }),
    [resolvedTheme, themePreference, accentColor]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
