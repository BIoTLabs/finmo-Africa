import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";
type ColorScheme = "default" | "ocean" | "sunset" | "forest" | "royal";

const COLOR_SCHEMES = {
  default: {
    light: {
      primary: "142 50% 45%",
      "primary-glow": "142 50% 55%",
      "primary-dark": "142 50% 35%",
      secondary: "45 95% 50%",
      success: "142 55% 42%",
    },
    dark: {
      primary: "142 50% 48%",
      "primary-glow": "142 50% 58%",
      "primary-dark": "142 50% 38%",
      secondary: "45 95% 55%",
      success: "142 55% 45%",
    },
  },
  ocean: {
    light: {
      primary: "200 80% 45%",
      "primary-glow": "200 80% 55%",
      "primary-dark": "200 80% 35%",
      secondary: "180 75% 50%",
      success: "190 70% 42%",
    },
    dark: {
      primary: "200 80% 50%",
      "primary-glow": "200 80% 60%",
      "primary-dark": "200 80% 40%",
      secondary: "180 75% 55%",
      success: "190 70% 48%",
    },
  },
  sunset: {
    light: {
      primary: "15 85% 50%",
      "primary-glow": "15 85% 60%",
      "primary-dark": "15 85% 40%",
      secondary: "330 80% 55%",
      success: "25 75% 45%",
    },
    dark: {
      primary: "15 85% 55%",
      "primary-glow": "15 85% 65%",
      "primary-dark": "15 85% 45%",
      secondary: "330 80% 60%",
      success: "25 75% 50%",
    },
  },
  forest: {
    light: {
      primary: "158 60% 38%",
      "primary-glow": "158 60% 48%",
      "primary-dark": "158 60% 28%",
      secondary: "172 55% 42%",
      success: "148 65% 35%",
    },
    dark: {
      primary: "158 60% 45%",
      "primary-glow": "158 60% 55%",
      "primary-dark": "158 60% 35%",
      secondary: "172 55% 48%",
      success: "148 65% 42%",
    },
  },
  royal: {
    light: {
      primary: "265 75% 50%",
      "primary-glow": "265 75% 60%",
      "primary-dark": "265 75% 40%",
      secondary: "245 70% 55%",
      success: "275 65% 45%",
    },
    dark: {
      primary: "265 75% 55%",
      "primary-glow": "265 75% 65%",
      "primary-dark": "265 75% 45%",
      secondary: "245 70% 60%",
      success: "275 65% 50%",
    },
  },
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme") as Theme;
    return stored || "system";
  });

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const stored = localStorage.getItem("colorScheme") as ColorScheme;
    return stored || "default";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let effectiveTheme: "light" | "dark";
    
    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      effectiveTheme = theme;
    }

    root.classList.add(effectiveTheme);

    // Apply color scheme
    const colors = COLOR_SCHEMES[colorScheme][effectiveTheme];
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, [theme, colorScheme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
  };

  const setColorScheme = (newColorScheme: ColorScheme) => {
    localStorage.setItem("colorScheme", newColorScheme);
    setColorSchemeState(newColorScheme);
  };

  return {
    theme,
    colorScheme,
    setTheme,
    setColorScheme,
  };
}
