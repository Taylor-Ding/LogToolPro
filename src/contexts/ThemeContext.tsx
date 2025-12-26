import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const stored = localStorage.getItem("theme");
        return (stored as Theme) || "light";
    });

    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem("theme", newTheme);
    };

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const updateResolvedTheme = () => {
            if (theme === "system") {
                setResolvedTheme(mediaQuery.matches ? "dark" : "light");
            } else {
                setResolvedTheme(theme);
            }
        };

        updateResolvedTheme();

        if (theme === "system") {
            mediaQuery.addEventListener("change", updateResolvedTheme);
            return () => mediaQuery.removeEventListener("change", updateResolvedTheme);
        }
    }, [theme]);

    useEffect(() => {
        const root = document.documentElement;
        if (resolvedTheme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [resolvedTheme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
