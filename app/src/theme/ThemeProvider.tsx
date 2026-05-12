import { createContext, useContext, type ReactNode } from "react";
import { tokens, typography, spacing, radius, elevation } from "./tokens";

const themeValue = {
  colors: tokens,
  typography,
  spacing,
  radius,
  elevation,
} as const;

export type Theme = typeof themeValue;

const ThemeContext = createContext<Theme>(themeValue);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
