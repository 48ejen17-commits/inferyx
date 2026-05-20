import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export const THEMES = {
  dark: {
    bg: "#07070f",
    bgSecondary: "#0d0d1a",
    bgCard: "rgba(255,255,255,0.04)",
    bgCardHover: "rgba(255,255,255,0.07)",
    bgInput: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.07)",
    borderInput: "rgba(255,255,255,0.1)",
    borderFocus: "#7c3aed",
    text: "#e2e8f0",
    textSecondary: "#94a3b8",
    textMuted: "#475569",
    textFaint: "#334155",
    sidebar: "rgba(255,255,255,0.03)",
    topbar: "rgba(255,255,255,0.01)",
    scrollbar: "#1e1e3a",
    inputBg: "#1a1a2e",
    optionBg: "#1a1a2e",
  },
  light: {
    bg: "#f1f5f9",
    bgSecondary: "#ffffff",
    bgCard: "rgba(255,255,255,0.9)",
    bgCardHover: "rgba(255,255,255,1)",
    bgInput: "#ffffff",
    border: "rgba(0,0,0,0.08)",
    borderInput: "rgba(0,0,0,0.12)",
    borderFocus: "#7c3aed",
    text: "#0f172a",
    textSecondary: "#334155",
    textMuted: "#64748b",
    textFaint: "#94a3b8",
    sidebar: "rgba(255,255,255,0.8)",
    topbar: "rgba(255,255,255,0.7)",
    scrollbar: "#cbd5e1",
    inputBg: "#ffffff",
    optionBg: "#ffffff",
  }
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem("inferyx-theme") || "dark");

  useEffect(() => {
    localStorage.setItem("inferyx-theme", mode);
    document.body.style.background = THEMES[mode].bg;
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const toggle = () => setMode(m => m === "dark" ? "light" : "dark");
  const theme = THEMES[mode];

  return (
    <ThemeContext.Provider value={{ mode, toggle, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
