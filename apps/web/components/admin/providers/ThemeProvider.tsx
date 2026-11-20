'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeChoice } from '@/lib/theme';
import { applyTheme } from '@/components/theme/apply-theme';

type Theme = ThemeChoice;

type ThemeState = {
  theme: Theme;
};

type ThemeActions = {
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<(ThemeState & ThemeActions) | undefined>(undefined);

/**
 * The admin's light/dark switch. It shares one setting with the shop (a
 * cookie the server reads), so the page arrives in the right colours with
 * no white flash, and the choice is the same in the admin and the shop.
 */
export function ThemeProvider({
  children,
  initialTheme = 'system',
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // The admin used to remember its choice in this browser only. Carry an old
  // choice over once, then forget it.
  useEffect(() => {
    try {
      const old = localStorage.getItem('admin.theme') as Theme | null;
      if (old) {
        localStorage.removeItem('admin.theme');
        if (initialTheme === 'system' && (old === 'light' || old === 'dark')) {
          applyTheme(old);
          setThemeState(old);
        }
      }
    } catch {
      // Storage can be blocked; the cookie still works.
    }
  }, [initialTheme]);

  const setTheme = (newTheme: Theme) => {
    applyTheme(newTheme);
    setThemeState(newTheme);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
