import { createContext, useContext, useState, useEffect } from "react";

type Theme = "light" | "dark" | "ai-assistant";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("app-theme") as Theme | null;
      if (savedTheme) return savedTheme;

      const isDark = document.documentElement.classList.contains("dark");
      return isDark ? "dark" : "light";
    }
    return "light";
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);

    const root = document.documentElement;
    root.classList.remove("light", "dark", "ai-assistant");

    if (newTheme !== "light") {
      root.classList.add(newTheme);
    }

    localStorage.setItem("app-theme", newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "ai-assistant");

    if (theme !== "light") {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
