import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, darkTheme, lightTheme } from '../theme';
import { ColorScheme } from '../types';

interface ThemeContextValue {
  theme: Theme;
  colorScheme: ColorScheme;
  toggleColorScheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('dark');

  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  const toggleColorScheme = useCallback(() => {
    setColorSchemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, toggleColorScheme, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
